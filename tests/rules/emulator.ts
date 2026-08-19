/**
 * Emulator reachability probe for the firestore.rules suites.
 *
 * The rules suites are the ONLY enforcement-surface tests in this repo, so they
 * must never be quietly dropped. They also cannot run without the Firestore
 * emulator (which needs Java), and a hard failure in `beforeAll` red-fails the
 * entire `vitest run tests/` gate on machines that only run the unit tests.
 *
 * The compromise: probe the emulator port, and when it is down mark the suites
 * SKIPPED with a loud banner instead of failing. `npm run test:rules` boots the
 * emulator first (firebase emulators:exec), so in the enforcement path the
 * probe succeeds and every assertion runs for real.
 */
import { connect } from 'node:net';

export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PORT = 8080;

const PROBE_TIMEOUT_MS = 1500;

/** Resolves true when something is accepting connections on the emulator port. */
export function isEmulatorReachable(
  host: string = EMULATOR_HOST,
  port: number = EMULATOR_PORT,
  timeoutMs: number = PROBE_TIMEOUT_MS
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    let settled = false;

    const finish = (reachable: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * Prints the skip banner. Loud on purpose: a green run with skipped rules
 * tests must never be mistaken for a verified security surface.
 */
export function warnEmulatorMissing(suiteName: string): void {
  console.warn(
    [
      '',
      '  ============================================================',
      `  SKIPPED: ${suiteName}`,
      `  No Firestore emulator on ${EMULATOR_HOST}:${EMULATOR_PORT}.`,
      '  firestore.rules was NOT verified by this run.',
      '  Run `npm run test:rules` (needs Java) to actually enforce it.',
      '  ============================================================',
      '',
    ].join('\n')
  );
}
