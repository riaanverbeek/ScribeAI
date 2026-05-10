const activeProcessingIds = new Set<number>();

export function acquireProcessingLock(meetingId: number): boolean {
  if (activeProcessingIds.has(meetingId)) return false;
  activeProcessingIds.add(meetingId);
  return true;
}

export function releaseProcessingLock(meetingId: number): void {
  activeProcessingIds.delete(meetingId);
}

export function isProcessingLocked(meetingId: number): boolean {
  return activeProcessingIds.has(meetingId);
}
