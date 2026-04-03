export function getWalkieRoleLabel(role = "") {
  if (role === "umpire") return "Umpire";
  if (role === "director") return "Director";
  if (role === "spectator") return "Spectator";
  return "Someone";
}

export function getWalkieRemoteSpeakerState({
  snapshot = null,
  participantId = "",
  isSelfTalking = false,
} = {}) {
  const activeSpeakerId = String(snapshot?.activeSpeakerId || "");
  const activeSpeakerRole = String(snapshot?.activeSpeakerRole || "");
  const activeSpeakerName = String(snapshot?.activeSpeakerName || "").trim();
  const roleLabel = getWalkieRoleLabel(activeSpeakerRole);
  const nameLabel = activeSpeakerName || roleLabel;
  const speakerLabel = activeSpeakerName
    ? `${activeSpeakerName} (${roleLabel})`
    : roleLabel;
  const isRemoteTalking = Boolean(
    snapshot?.enabled &&
      snapshot?.busy &&
      activeSpeakerId &&
      !isSelfTalking &&
      (!participantId || activeSpeakerId !== participantId)
  );

  if (!isRemoteTalking) {
    return {
      isRemoteTalking: false,
      roleLabel: "",
      nameLabel: "",
      shortStatus: "",
      title: "",
      detail: "",
      capsuleLabel: "",
    };
  }

  return {
    isRemoteTalking: true,
    roleLabel,
    nameLabel,
    shortStatus: `${speakerLabel} is talking.`,
    title: `${speakerLabel} is talking.`,
    detail: activeSpeakerName
      ? `${activeSpeakerName} has the walkie live right now.`
      : "Please wait while the current speaker finishes.",
    capsuleLabel: activeSpeakerName
      ? `${roleLabel.toUpperCase()} LIVE`
      : `${roleLabel.toUpperCase()} TALKING`,
  };
}
