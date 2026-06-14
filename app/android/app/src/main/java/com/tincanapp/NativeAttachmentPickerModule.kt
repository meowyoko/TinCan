package com.tincanapp

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream

class NativeAttachmentPickerModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  private var pendingPromise: Promise? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = "NativeAttachmentPicker"

  @ReactMethod
  fun pick(kind: String?, promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("E_PICKER_IN_PROGRESS", "Another attachment request is already running.")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No active Android activity is available.")
      return
    }

    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      when (kind) {
        "image" -> {
          type = "image/*"
        }
        else -> {
          type = "*/*"
          putExtra(
            Intent.EXTRA_MIME_TYPES,
            arrayOf("application/*", "text/*", "audio/*", "video/*"),
          )
        }
      }
      putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    }

    pendingPromise = promise

    try {
      @Suppress("DEPRECATION")
      activity.startActivityForResult(intent, REQUEST_CODE_PICK_ATTACHMENT)
    } catch (error: Exception) {
      pendingPromise = null
      promise.reject("E_PICKER_UNAVAILABLE", error.message, error)
    }
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    if (requestCode != REQUEST_CODE_PICK_ATTACHMENT) {
      return
    }

    val promise = pendingPromise ?: return
    pendingPromise = null

    val pickedUri = data?.data
    if (resultCode != Activity.RESULT_OK || pickedUri == null) {
      promise.reject("E_PICKER_CANCELLED", "Attachment picking was cancelled.")
      return
    }

    try {
      val resolver = reactApplicationContext.contentResolver
      try {
        resolver.takePersistableUriPermission(
          pickedUri,
          Intent.FLAG_GRANT_READ_URI_PERMISSION,
        )
      } catch (_: SecurityException) {
      }

      val metadata = readMetadata(pickedUri)
      val result = Arguments.createMap().apply {
        putString("uri", pickedUri.toString())
        putString("name", metadata.name)
        putString("type", metadata.mimeType)
        metadata.size?.let { putDouble("size", it.toDouble()) }
        putString("base64", readBase64(pickedUri))
      }

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("E_READ_ATTACHMENT", error.message, error)
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun readMetadata(uri: Uri): AttachmentMetadata {
    val resolver = reactApplicationContext.contentResolver
    var name: String? = null
    var size: Long? = null

    resolver.query(uri, null, null, null, null)?.use { cursor ->
      val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)

      if (cursor.moveToFirst()) {
        if (nameIndex >= 0 && !cursor.isNull(nameIndex)) {
          name = cursor.getString(nameIndex)
        }
        if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
          size = cursor.getLong(sizeIndex)
        }
      }
    }

    return AttachmentMetadata(
      name = name ?: uri.lastPathSegment ?: "attachment",
      mimeType = resolver.getType(uri),
      size = size,
    )
  }

  private fun readBase64(uri: Uri): String {
    val resolver = reactApplicationContext.contentResolver
    resolver.openInputStream(uri)?.use { input ->
      val buffer = ByteArray(8 * 1024)
      val output = ByteArrayOutputStream()

      while (true) {
        val bytesRead = input.read(buffer)
        if (bytesRead == -1) {
          break
        }
        output.write(buffer, 0, bytesRead)
      }

      return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
    }

    throw IllegalStateException("Failed to open the selected attachment.")
  }

  private data class AttachmentMetadata(
    val name: String,
    val mimeType: String?,
    val size: Long?,
  )

  private companion object {
    const val REQUEST_CODE_PICK_ATTACHMENT = 5417
  }
}
