import React, { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { all_routes } from "../router/all_routes";
import { useAuth } from "../../contexts/AuthContext";

const sanitizeRoomName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

const isJitsiLink = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "meet.jit.si";
  } catch {
    return false;
  }
};

const MeetingRoom = () => {
  const routes = all_routes;
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();

  const allowed = useMemo(
    () => user?.role === "STARTUP" || user?.role === "EXPERT" || user?.role === "S2T",
    [user?.role]
  );

  const initialLink = searchParams.get("link") || "";
  const initialRoom = searchParams.get("room") || "";
  const initialTitle = searchParams.get("title") || "";

  const [roomName, setRoomName] = useState(initialRoom);
  const [meetingTitle, setMeetingTitle] = useState(initialTitle);
  const [customLink, setCustomLink] = useState(initialLink);
  const [activeMeetingUrl, setActiveMeetingUrl] = useState(initialLink);
  const [error, setError] = useState("");

  const startMeeting = () => {
    setError("");
    if (customLink.trim()) {
      const safeLink = customLink.trim();
      setActiveMeetingUrl(safeLink);
      return;
    }

    const safeRoom = sanitizeRoomName(roomName || meetingTitle || `synergy-${Date.now()}`);
    if (!safeRoom) {
      setError("Please enter a room name or meeting title.");
      return;
    }
    setActiveMeetingUrl(`https://meet.jit.si/${safeRoom}`);
  };

  if (loading) return null;
  if (!allowed) return <Navigate to={routes.unauthorized} replace />;

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h4 className="mb-1">Meeting Room</h4>
            <p className="text-muted mb-0">Join or start online meetings directly in the platform.</p>
          </div>
          <Link to={routes.meetingsPlanner} className="btn btn-light btn-sm">
            Back to Planner
          </Link>
        </div>

        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Meeting Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="Team weekly sync"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Room Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="startup-expert-review"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Meeting Link (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  placeholder="https://meet.jit.si/..."
                />
              </div>
            </div>
            {error && (
              <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                {error}
              </div>
            )}
            <div className="mt-3 d-flex align-items-center gap-2 flex-wrap">
              <button type="button" className="btn btn-primary btn-sm" onClick={startMeeting}>
                Open Meeting Room
              </button>
              {activeMeetingUrl && (
                <a href={activeMeetingUrl} target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm">
                  Open in New Tab
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body p-0">
            {activeMeetingUrl ? (
              isJitsiLink(activeMeetingUrl) ? (
                <iframe
                  title="Meeting Room"
                  src={activeMeetingUrl}
                  style={{ width: "100%", height: "78vh", border: 0, borderRadius: "0.75rem" }}
                  allow="camera; microphone; fullscreen; display-capture; clipboard-write"
                />
              ) : (
                <div className="p-4">
                  <p className="mb-2 text-muted">This link cannot be embedded here. Open it in a new tab:</p>
                  <a href={activeMeetingUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                    Open External Meeting Link
                  </a>
                </div>
              )
            ) : (
              <div className="p-4">
                <p className="text-muted mb-0">Choose a room name or paste a meeting link, then click Open Meeting Room.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;
