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
  await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "-l", text], { timeout: timeoutMs });
  await execFileAsync("tmux", ["send-keys", "-t", `${session}:0`, "Enter"], { timeout: timeoutMs });
}
