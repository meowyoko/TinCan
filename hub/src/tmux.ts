import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function hasTmuxSession(session: string): Promise<boolean> {
  try {
    await execFileAsync("tmux", ["has-session", "-t", session], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

export async function sendToTmux(session: string, text: string, timeoutMs: number): Promise<void> {
  await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "Escape"], { timeout: timeoutMs });
  await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "-l", text], { timeout: timeoutMs });
  await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "Enter"], { timeout: timeoutMs });
}

export async function capturePane(session: string, startLine: number, timeoutMs: number): Promise<string> {
  const { stdout } = await execFileAsync(
    "tmux",
    ["capture-pane", "-p", "-e", "-t", `${session}:0`, "-S", String(startLine)],
    { timeout: timeoutMs }
  );
  return stdout;
}

export async function sendApprovalDecision(
  session: string,
  decision: "allow" | "deny",
  timeoutMs: number,
  denyIndex: number | null
): Promise<void> {
  if (decision === "allow") {
    await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "Enter"], { timeout: timeoutMs });
    return;
  }

  const denyKey = String(denyIndex ?? 3);
  await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "-l", denyKey], { timeout: timeoutMs });
  await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "Enter"], { timeout: timeoutMs });
}

export async function dismissSessionSurvey(
  session: string,
  timeoutMs: number
): Promise<void> {
  await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "-l", "0"], { timeout: timeoutMs });
  await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "Enter"], { timeout: timeoutMs });
}
