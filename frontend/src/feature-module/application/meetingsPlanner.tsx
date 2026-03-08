import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import Modal from "react-bootstrap/Modal";
import { all_routes } from "../router/all_routes";
import { meetingsAPI } from "../../services/apiService";
import { useAuth } from "../../contexts/AuthContext";

type MeetingEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  color?: string;
  extendedProps: {
    location?: string;
    description?: string;
    meetingType?: "ONLINE" | "OFFLINE";
    meetingLink?: string;
    creatorName?: string;
  };
};

const MeetingsPlanner = () => {
  const routes = all_routes;
  const { user, loading } = useAuth();
  const [events, setEvents] = useState<MeetingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MeetingEvent | null>(null);
  const [form, setForm] = useState({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    meetingType: "ONLINE",
    meetingLink: "",
    location: "",
    description: "",
  });

  const allowed = useMemo(
    () => user?.role === "STARTUP" || user?.role === "EXPERT" || user?.role === "S2T",
    [user?.role]
  );

  const buildIsoFromDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return "";
    const d = new Date(`${dateStr}T${timeStr}`);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  };

  const generateMeetingLink = () => {
    const meetingId = `synergy-${Date.now()}`;
    return `https://meet.jit.si/${meetingId}`;
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    setActionError("");
    try {
      const res = await meetingsAPI.list({ upcoming: true });
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      const mapped: MeetingEvent[] = rows.map((e: any) => ({
        id: String(e?._id),
        title: String(e?.title || "Meeting"),
        start: String(e?.start),
        end: e?.end ? String(e.end) : undefined,
        color: e?.color || (String(e?.meetingType || "").toUpperCase() === "ONLINE" ? "#2066FF" : "#F26522"),
        extendedProps: {
          location: e?.location || "",
          description: e?.description || "",
          meetingType: String(e?.meetingType || "OFFLINE").toUpperCase() === "ONLINE" ? "ONLINE" : "OFFLINE",
          meetingLink: e?.meetingLink || "",
          creatorName:
            `${e?.creatorId?.firstName || ""} ${e?.creatorId?.lastName || ""}`.trim() || e?.creatorId?.email || "",
        },
      }));
      setEvents(mapped);
    } catch (e: any) {
      setEvents([]);
      setActionError(e?.message || "Failed to load meetings");
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    fetchEvents();
  }, [allowed]);

  const upcomingMeetings = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((ev) => new Date(ev.start).getTime() >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 6);
  }, [events]);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    const start = buildIsoFromDateTime(form.date, form.startTime);
    const end = form.endTime ? buildIsoFromDateTime(form.date, form.endTime) : "";
    if (!form.title.trim() || !start) {
      setActionError("Title, date and start time are required");
      return;
    }
    const isOnline = form.meetingType === "ONLINE";
    const meetingLink = isOnline ? (form.meetingLink.trim() || generateMeetingLink()) : "";
    try {
      await meetingsAPI.create({
        title: form.title.trim(),
        start,
        end: end || undefined,
        location: isOnline ? "Online meeting" : form.location.trim(),
        description: form.description.trim(),
        meetingType: form.meetingType,
        isOnline,
        meetingLink,
        targetRoles: ["STARTUP", "EXPERT", "S2T"],
      });
      setShowCreate(false);
      setForm({
        title: "",
        date: "",
        startTime: "",
        endTime: "",
        meetingType: "ONLINE",
        meetingLink: "",
        location: "",
        description: "",
      });
      await fetchEvents();
    } catch (e: any) {
      setActionError(e?.message || "Failed to create meeting");
    }
  };

  if (loading) return null;
  if (!allowed) return <Navigate to={routes.unauthorized} replace />;

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h4 className="mb-1">Meetings Planner</h4>
            <p className="text-muted mb-0">Plan online meetings for STARTUP, EXPERT and S2T.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-light btn-sm" onClick={fetchEvents}>
              Refresh
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              Create Meeting
            </button>
          </div>
        </div>

        {actionError && (
          <div className="alert alert-danger py-2" role="alert">
            {actionError}
          </div>
        )}

        <div className="row">
          <div className="col-xl-8 d-flex">
            <div className="card flex-fill">
              <div className="card-body">
                {loadingEvents ? (
                  <p className="text-muted mb-0">Loading meetings...</p>
                ) : (
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    events={events}
                    headerToolbar={{
                      start: "today,prev,next",
                      center: "title",
                      end: "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    eventClick={(info) => setSelectedEvent(info.event as any)}
                    height="auto"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-4 d-flex">
            <div className="card flex-fill">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="mb-0">Upcoming Meetings</h5>
                <Link to={routes.employeeDashboard} className="btn btn-light btn-sm">
                  Back
                </Link>
              </div>
              <div className="card-body">
                {upcomingMeetings.length === 0 ? (
                  <p className="text-muted mb-0">No upcoming meetings.</p>
                ) : (
                  upcomingMeetings.map((meeting) => (
                    <div className="border rounded p-2 mb-2" key={meeting.id}>
                      <h6 className="mb-1 text-truncate">{meeting.title}</h6>
                      <p className="fs-12 text-muted mb-1">
                        {new Date(meeting.start).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="fs-12 mb-2">{meeting.extendedProps.meetingType === "ONLINE" ? "Online" : "Offline"}</p>
                      {meeting.extendedProps.meetingLink && (
                        <Link
                          to={`${routes.meetingRoom}?link=${encodeURIComponent(
                            meeting.extendedProps.meetingLink
                          )}&title=${encodeURIComponent(meeting.title)}`}
                          className="btn btn-sm btn-outline-primary"
                        >
                          Open Room
                        </Link>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <form onSubmit={handleCreateMeeting}>
          <div className="modal-header">
            <h5 className="modal-title">Create Meeting</h5>
            <button type="button" className="btn-close" onClick={() => setShowCreate(false)} />
          </div>
          <div className="modal-body">
            <div className="mb-2">
              <label className="form-label">Title</label>
              <input
                className="form-control"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Start</label>
                <input
                  type="time"
                  className="form-control"
                  value={form.startTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">End</label>
                <input
                  type="time"
                  className="form-control"
                  value={form.endTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="form-label">Meeting Type</label>
              <select
                className="form-select"
                value={form.meetingType}
                onChange={(e) => setForm((prev) => ({ ...prev, meetingType: e.target.value }))}
              >
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </div>
            {form.meetingType === "ONLINE" ? (
              <div className="mt-2">
                <label className="form-label">Meeting Link (optional)</label>
                <input
                  className="form-control"
                  placeholder="Auto-generated if empty"
                  value={form.meetingLink}
                  onChange={(e) => setForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                />
              </div>
            ) : (
              <div className="mt-2">
                <label className="form-label">Location</label>
                <input
                  className="form-control"
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                />
              </div>
            )}
            <div className="mt-2">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-light" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Meeting
            </button>
          </div>
        </form>
      </Modal>

      <Modal show={!!selectedEvent} onHide={() => setSelectedEvent(null)} centered>
        <div className="modal-header">
          <h5 className="modal-title">{selectedEvent?.title}</h5>
          <button type="button" className="btn-close" onClick={() => setSelectedEvent(null)} />
        </div>
        <div className="modal-body">
          <p className="mb-2">
            <strong>Date:</strong>{" "}
            {selectedEvent?.start
              ? new Date(selectedEvent.start).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </p>
          {!!selectedEvent?.extendedProps?.description && (
            <p className="mb-2">
              <strong>Description:</strong> {selectedEvent.extendedProps.description}
            </p>
          )}
          <p className="mb-2">
            <strong>Type:</strong> {selectedEvent?.extendedProps?.meetingType || "OFFLINE"}
          </p>
          {!!selectedEvent?.extendedProps?.meetingLink && (
            <Link
              to={`${routes.meetingRoom}?link=${encodeURIComponent(
                selectedEvent.extendedProps.meetingLink
              )}&title=${encodeURIComponent(selectedEvent.title)}`}
              className="btn btn-primary btn-sm"
            >
              Open Meeting Room
            </Link>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default MeetingsPlanner;
