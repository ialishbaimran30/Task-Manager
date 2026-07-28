import React, { useState, useEffect } from "react";
import api from "../services/api";
import Sidebar from "../components/Sidebar";
import "../styles/team.css";
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Swal from 'sweetalert2';

export default function TeamCollaboration() {
  const [groups, setGroups] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [userPersonalTasks, setUserPersonalTasks] = useState([]);

  // Form states
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");

  // Assign Existing Task states
  const [selectedExistingTaskId, setSelectedExistingTaskId] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState([]);

  // Modal Control & Modal Form States
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDescription, setModalDescription] = useState("");
  const [modalSubtasks, setModalSubtasks] = useState([""]);
  const [modalAssignees, setModalAssignees] = useState([]);

  const currentUser = localStorage.getItem("username");

  const fetchData = () => {
    // 1. Fetch Team Groups
    api.get("/tasks/groups/").then((res) => {
      setGroups(res.data);
      if (selectedGroup) {
        const updated = res.data.find((g) => g.id === selectedGroup.id);
        if (updated) setSelectedGroup(updated);
      }
    });

    // 2. Fetch Group Invitations
    api.get("/tasks/groups/my_invitations/").then((res) => {
      setInvitations(res.data);
    });

    // 3. Fetch Personal Tasks
    api
      .get("/tasks/api/")
      .then((res) => {
        const rawTasks = Array.isArray(res.data)
          ? res.data
          : res.data && res.data.results
          ? res.data.results
          : [];

        setUserPersonalTasks(rawTasks);
      })
      .catch((err) => console.log("Could not fetch personal tasks", err));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Dropdown Select Existing Task
  const handleSelectExistingTask = (e) => {
    setSelectedExistingTaskId(e.target.value);
  };

  // Group Creation
  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    api.post("/tasks/groups/", { name: newGroupName, description: newGroupDesc }).then((res) => {
      setNewGroupName("");
      setNewGroupDesc("");
      toast("Group created");
      fetchData();
      setSelectedGroup(res.data);
    });
  };

  // Invite Handler
  const handleSendInvite = (e) => {
    e.preventDefault();
    if (!inviteUsername.trim() || !selectedGroup) return;
    api
      .post(`/tasks/groups/${selectedGroup.id}/invite_member/`, { username: inviteUsername })
      .then((res) => {
        toast(res.data.message || "Invite sent!");
        setInviteUsername("");
        fetchData();
      })
      .catch((err) => toast(err.response?.data?.error || "Failed to send invite"));
  };

  const handleRespondInvite = (inviteId, action,inv=null) => {
    api.post("/tasks/groups/respond_invite/", { invite_id: inviteId, action }).then(() => {
      toast(`Invite ${action}ed`);
      fetchData();
      if(inv){
        console.log("Full invite object:", inv);}
    });
  };

  const handleDeleteGroup = (groupId) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "Are you sure you want to delete this group?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        api.delete(`/tasks/groups/${groupId}/`).then(() => {
          toast("Group deleted");
          setSelectedGroup(null);
          fetchData();
        }).catch(() => toast("Failed to delete group"));
      }
    });
  };

  const handleDeleteTask = (taskId) => {
    Swal.fire({
      title: 'Delete Task?',
      text: "Are you sure you want to delete this task?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete'
    }).then((result) => {
      if (result.isConfirmed) {
        api
          .delete(`/tasks/group-tasks/${taskId}/`)
          .then(() => {
            toast("Task deleted");
            fetchData();
          })
          .catch((err) => toast(err.response?.data?.error || "Failed to delete task"));
      }
    });
  };

  // Checkbox Handler for Member Selection in Import Section
  const handleAssigneeCheckboxChange = (userId) => {
    if (selectedAssignees.includes(userId)) {
      setSelectedAssignees(selectedAssignees.filter((id) => id !== userId));
    } else {
      setSelectedAssignees([...selectedAssignees, userId]);
    }
  };

  // Existing Task Assign Handler
  const handleAssignImportedTask = async (e) => {
    e.preventDefault();
    if (!selectedExistingTaskId || !selectedGroup) return;

    const token = localStorage.getItem("token") || localStorage.getItem("access");

    try {
      const taskToImport = userPersonalTasks.find(
        (t) => String(t.id) === String(selectedExistingTaskId)
      );

      if (!taskToImport) {
        toast("Selected task not found");
        return;
      }

      const payload = {
        group: selectedGroup.id,
        title: taskToImport.title,
        description: taskToImport.description || "",
        subtasks: taskToImport.subtasks ? taskToImport.subtasks.map((s) => s.title || s) : [],
        assignees: []
      };

      const res = await axios.post(
        "http://127.0.0.1:8000/tasks/group-tasks/",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      toast("Task assigned successfully!");
      setSelectedExistingTaskId("");
      
      if (res.data) {
        setSelectedGroup((prev) => ({
          ...prev,
          tasks: [...(prev.tasks || []), res.data]
        }));
      }

    } catch (error) {
      console.error("Task assignment error details:", error.response?.data);
      const errDetail = error.response?.data 
        ? JSON.stringify(error.response.data) 
        : "Server Error";
      toast(`Task assignment failed: ${errDetail}`);
    }
  };

  // Modal Task Creation Handler
  const handleCreateTaskFromModal = async (e) => {
    e.preventDefault();
    if (!modalTitle.trim() || !selectedGroup) return;

    const token = localStorage.getItem("token") || localStorage.getItem("access");

    try {
      const payload = {
        group: selectedGroup.id,
        title: modalTitle,
        description: modalDescription,
        subtasks: modalSubtasks.filter((st) => st.trim() !== ""),
        assignees: []
      };

      const res = await axios.post(
        "http://127.0.0.1:8000/tasks/group-tasks/",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      toast("Task saved");

      if (res.data) {
        setSelectedGroup((prev) => ({
          ...prev,
          tasks: [...(prev.tasks || []), res.data]
        }));
      }

      setModalTitle("");
      setModalDescription("");
      setModalSubtasks([""]);
      setShowTaskModal(false);

    } catch (error) {
      console.error("Task creation error details:", error.response?.data);
      const errDetail = error.response?.data 
        ? JSON.stringify(error.response.data) 
        : "Server Error";
      toast(`Task creation failed: ${errDetail}`);
    }
  };

  // Modal Subtask Fields Handlers
  const handleAddSubtaskField = () => {
    setModalSubtasks([...modalSubtasks, ""]);
  };

  const handleSubtaskChange = (index, value) => {
    const updated = [...modalSubtasks];
    updated[index] = value;
    setModalSubtasks(updated);
  };

  const handleRemoveSubtaskField = (index) => {
    const updated = modalSubtasks.filter((_, i) => i !== index);
    setModalSubtasks(updated);
  };

  // Checkbox Handler for Member Selection inside Modal
  const handleModalAssigneeCheckboxChange = (userId) => {
    if (modalAssignees.includes(userId)) {
      setModalAssignees(modalAssignees.filter((id) => id !== userId));
    } else {
      setModalAssignees([...modalAssignees, userId]);
    }
  };

  const handleTaskStatusChange = (taskId, newStatus) => {
    api
      .patch(`/tasks/group-tasks/${taskId}/`, { status: newStatus })
      .then(() => {
        toast("Status updated");
        fetchData();
      })
      .catch((err) => toast(err.response?.data?.error || "Permission denied"));
  };

  const handleAssignSubtaskMember = (subtaskId, userId) => {
    api
      .patch(`/tasks/group-subtasks/${subtaskId}/`, { assigned_to: userId || null })
      .then(() => {
        toast("Subtask assigned");
        fetchData();
      })
      .catch((err) => toast(err.response?.data?.detail || "Could not reassign subtask"));
  };

  // Subtask Completion Toggle
  const handleToggleSubtask = (subtask) => {
    const isSubtaskAssignedToMe = subtask.assigned_to_details?.username === currentUser;
    
    if (!isSubtaskAssignedToMe) {
      toast("Permission Denied!");
      return;
    }

    api
      .patch(`/tasks/group-subtasks/${subtask.id}/`, { is_completed: !subtask.is_completed })
      .then(() => fetchData())
      .catch((err) =>
        toast(err.response?.data?.detail || "Only assigned user can update this status!")
      );
  };

  const handleDeleteSubtask = (subtaskId) => {
    Swal.fire({
      title: 'Delete Subtask?',
      text: "Do you want to delete this subtask?",
      icon: 'warning',
      width: '360px',
      padding: '20px',
      showCancelButton: true,
      confirmButtonColor: '#c46464',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete'
    }).then((result) => {
      if (result.isConfirmed) {
        api
          .delete(`/tasks/group-subtasks/${subtaskId}/`)
          .then(() => {
            toast("Subtask deleted");
            fetchData();
          })
          .catch((err) => toast(err.response?.data?.error || "Failed to delete subtask"));
      }
    });
  };

  const handleLeaveGroup = (groupId) => {
    Swal.fire({
      title: 'Leave Group?',
      text: "Are you sure you want to leave this group?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#c2410c',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, leave'
    }).then((result) => {
      if (result.isConfirmed) {
        api
          .post(`/tasks/groups/${groupId}/leave_group/`)
          .then((res) => {
            toast(res.data?.message || "Group left successfully!");
            setSelectedGroup(null);
            localStorage.removeItem("activeGroupId");
            fetchData();
          })
          .catch((err) => toast(err.response?.data?.error || "Unable to leave group."));
      }
    });
  };

  const allGroupMembers = selectedGroup?.members || [];
  const isOwner = selectedGroup?.created_by_details?.username === currentUser;

  

  return (
  <div className="app-shell">
    <ToastContainer 
      position="top-center" 
      autoClose={2000} 
      hideProgressBar={true}
      closeButton={false}
      toastClassName="custom-pill-toast"
      icon={false}
    />
    <Sidebar />
    <main className="app-main dash-main" style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      
      {/* Invitation Banner */}
      {invitations.length > 0 && (
        <div className="invitation-banner" style={{ marginBottom: "28px" }}>
          <h3 style={{ margin: "0 0 14px 0", color: "#3730a3", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
            📩 Group Invitations
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {invitations.map((inv) => (
              <div key={inv.id} className="invite-chip">
                <span style={{ color: "#334155", fontSize: "14px" }}>
                  You have been invited to join group <strong>'{inv.group_name || inv.group?.name || inv.group || "Group"}'</strong> by <strong>{inv.invited_by_username || inv.invited_by?.username || inv.sender_username || inv.sender?.username || "Someone"}</strong>.
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn-gradient-primary" style={{ padding: "6px 14px", fontSize: "12px" }} onClick={() => handleRespondInvite(inv.id, "accept")}>
                    Accept
                  </button>
                  <button
                    style={{ background: "#f1f5f9", color: "#64748b", border: "none", padding: "6px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                    onClick={() => handleRespondInvite(inv.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 1: Main Dashboard Groups List */}
      {!selectedGroup ? (
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#0f172a", marginBottom: "24px" }}>Team Workspace</h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            
            {/* Create Group Form */}
            <div className="modern-card">
              <h3 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>Create New Team Group</h3>
              <form onSubmit={handleCreateGroup} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Group Name *"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
                <textarea
                  className="form-input"
                  placeholder="Description (Optional)"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  style={{ minHeight: "90px", resize: "vertical" }}
                />
                <button type="submit" className="btn-gradient-primary">
                  + Create Workspace Group
                </button>
              </form>
            </div>

            {/* Your Team Groups */}
            <div className="modern-card">
              <h3 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>Your Team Groups</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {groups.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "14px", fontStyle: "italic" }}>No groups created yet.</p>
                ) : (
                  groups.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGroup(g)}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "0.2s"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "16px" }}>{g.name}</div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>👑 Owner: {g.created_by_details?.username}</div>
                      </div>
                      <span style={{ background: "#e0e7ff", color: "#4338ca", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" }}>
                        {g.progress || g.progress_percentage || 0}% Done
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* VIEW 2: Workspace Detail Layout */
        <div>
          <button
            onClick={() => {
              setSelectedGroup(null);
              localStorage.removeItem("activeGroupId");
            }}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              padding: "8px 16px",
              borderRadius: "10px",
              cursor: "pointer",
              marginBottom: "20px",
              fontWeight: "600",
              color: "#475569",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            ← Back to All Groups
          </button>

          {/* Group Details Card */}
          <div className="modern-card">
            {/* Header Section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
              <div>
                <h1 style={{ margin: 0, fontSize: "28px", color: "#0f172a", fontWeight: "700" }}>{selectedGroup.name}</h1>
                <p style={{ color: "#64748b", marginTop: "6px", fontSize: "14px", lineHeight: "1.5" }}>
                  {selectedGroup.description || "No description provided."}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                {/* SVG Progress Ring */}
                <div style={{ position: "relative", width: "64px", height: "64px" }}>
                  <svg width="64" height="64" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="3.5"
                      strokeDasharray={`${selectedGroup.progress || selectedGroup.progress_percentage || 0}, 100`}
                      strokeLinecap="round"
                    />
                    <text x="18" y="20.35" fill="#4f46e5" fontSize="8.5" textAnchor="middle" fontWeight="bold">
                      {selectedGroup.progress || selectedGroup.progress_percentage || 0}%
                    </text>
                  </svg>
                </div>

                {/* Conditional Actions: Owner = Delete | Member = Leave */}
                {isOwner ? (
                  <button
                    style={{
                      background: "#fee2e2",
                      color: "#ef4444",
                      border: "1px solid #fca5a5",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontSize: "13px"
                    }}
                    onClick={() => handleDeleteGroup(selectedGroup.id)}
                  >
                    Delete Group
                  </button>
                ) : (
                  <button
                    style={{
                      background: "#ffedd5",
                      color: "#c2410c",
                      border: "1px solid #fed7aa",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontSize: "13px"
                    }}
                    onClick={() => handleLeaveGroup(selectedGroup.id)}
                  >
                    Leave Group
                  </button>
                )}
              </div>
            </div>

            <hr style={{ margin: "24px 0", border: "0", borderTop: "1px solid #f1f5f9" }} />

            {/* Grid 1: Invite & Members */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div>
                <h4 style={{ margin: "0 0 12px 0", color: "#334155" }}>Invite Member</h4>
                {isOwner ? (
                  <form onSubmit={handleSendInvite} style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter username..."
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn-gradient-primary">Send Invite</button>
                  </form>
                ) : (
                  <p style={{ color: "#94a3b8", fontSize: "13px" }}>Only the group owner can send member invites.</p>
                )}
              </div>

              <div>
                <h4 style={{ margin: "0 0 12px 0", color: "#334155" }}>Group Members ({allGroupMembers.length + 1})</h4>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span className="badge badge-owner">
                    👑 Owner: {selectedGroup.created_by_details?.username || selectedGroup.created_by_username || "Owner"}
                  </span>
                  {allGroupMembers.map((m) => (
                    <span key={m.id} className={`badge ${m.status === "Accepted" ? "badge-accepted" : "badge-pending"}`}>
                      👤 {m.user_username || m.user_details?.username || m.username || "User"} ({m.status})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid 2: Assign Task Section */}
            {isOwner && (
              <div style={{ marginTop: "28px", background: "#f8fafc", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                <h4 style={{ margin: "0 0 14px 0", color: "#1e293b" }}>Assign New Task</h4>
                
                <form onSubmit={handleAssignImportedTask} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  
                  {/* Dropdown Select Existing Task */}
                  <div style={{ background: "#eef2ff", padding: "12px", borderRadius: "10px", border: "1px solid #c7d2fe" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#3730a3", display: "block", marginBottom: "6px" }}>
                      Import From Existing Tasks:
                    </label>
                    <select
                      value={selectedExistingTaskId}
                      onChange={handleSelectExistingTask}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #a5b4fc",
                        background: "#ffffff",
                        fontSize: "14px",
                        color: "#1e1b4b",
                        fontWeight: "500"
                      }}
                    >
                      <option value="">-- Select an Existing Task --</option>
                      {userPersonalTasks.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          📌 {pt.title} {pt.subtasks?.length ? `(${pt.subtasks.length} subtasks)` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* "+ Create New Task" Trigger Button */}
                  <div>
                    <button
                      type="button"
                      className="btn-gradient-primary"
                      onClick={() => setShowTaskModal(true)}
                      style={{ width: "100%", padding: "10px 0", fontWeight: "600" }}
                    >
                      + Create New Task
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="btn-gradient-primary"
                    disabled={!selectedExistingTaskId}
                    style={{
                      alignSelf: "flex-start",
                      marginTop: "6px",
                      opacity: selectedExistingTaskId ? 1 : 0.6,
                      cursor: selectedExistingTaskId ? "pointer" : "not-allowed"
                    }}
                  >
                    Assign Selected Task
                  </button>
                </form>
              </div>
            )}

            {/* Group Tasks & Subtasks Display Section */}
            <div style={{ marginTop: "32px" }}>
              <h3 style={{ color: "#0f172a", marginBottom: "16px" }}>Group Tasks ({selectedGroup.tasks?.length || 0})</h3>
              {selectedGroup.tasks?.length === 0 ? (
                <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "14px" }}>No tasks created yet for this group.</p>
              ) : (
                selectedGroup.tasks.map((gt) => {
                  const isAssigned = gt.assignees_details?.some((a) => a.username === currentUser);
                  const canEditStatus = isOwner || isAssigned;

                  return (
                    <div
                      key={gt.id}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        padding: "20px",
                        borderRadius: "14px",
                        marginBottom: "16px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.02)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>{gt.title}</h4>
                          {gt.description && <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px", margin: 0 }}>{gt.description}</p>}
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>Status:</span>
                            <select
                              value={gt.status}
                              disabled={!canEditStatus}
                              onChange={(e) => handleTaskStatusChange(gt.id, e.target.value)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                background: canEditStatus ? "#ffffff" : "#f1f5f9",
                                cursor: canEditStatus ? "pointer" : "not-allowed",
                                fontWeight: "600",
                                fontSize: "13px",
                                color: "#334155"
                              }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>

                          {isOwner && (
                            <button
                              onClick={() => handleDeleteTask(gt.id)}
                              title="Delete Task"
                              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", padding: "6px 10px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Subtasks Display Section */}
                      {gt.subtasks && gt.subtasks.length > 0 && (
                        <div style={{ marginTop: "16px", background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                          <h5 style={{ margin: "0 0 10px 0", color: "#334155", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Subtask Action Items ({gt.subtasks.filter(st => st.is_completed).length}/{gt.subtasks.length})
                          </h5>
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {gt.subtasks.map((st) => {
                              const isSubtaskAssignedToMe = st.assigned_to_details?.username === currentUser;

                              return (
                                <div
                                  key={st.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    background: "#ffffff",
                                    padding: "10px 14px",
                                    borderRadius: "8px",
                                    border: "1px solid #cbd5e1"
                                  }}
                                >
                                  {/* Left: Checkbox & Title */}
                                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: isSubtaskAssignedToMe ? "pointer" : "not-allowed" }}>
                                    <input
                                      type="checkbox"
                                      checked={st.is_completed}
                                      disabled={!isSubtaskAssignedToMe}
                                      onChange={() => handleToggleSubtask(st)}
                                      style={{ accentColor: "#4f46e5", width: "16px", height: "16px", cursor: isSubtaskAssignedToMe ? "pointer" : "not-allowed" }}
                                    />
                                    <span style={{
                                      fontSize: "14px",
                                      fontWeight: "500",
                                      color: st.is_completed ? "#94a3b8" : "#1e293b",
                                      textDecoration: st.is_completed ? "line-through" : "none"
                                    }}>
                                      {st.title}
                                    </span>
                                  </label>

                                  {/* Right: Subtask Assignment Dropdown & Actions */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    {isOwner ? (
                                      <select
                                        value={st.assigned_to || ""}
                                        onChange={(e) => handleAssignSubtaskMember(st.id, e.target.value)}
                                        style={{
                                          padding: "4px 8px",
                                          borderRadius: "6px",
                                          border: "1px solid #cbd5e1",
                                          fontSize: "12px",
                                          background: "#ffffff",
                                          color: "#334155"
                                        }}
                                      >
                                        <option value="">-- Assign Member --</option>
                                        {allGroupMembers.map((m) => (
                                          <option key={m.id} value={m.user}>
                                            👤 {m.user_details?.username}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                                        👤 {st.assigned_to_details?.username || "Unassigned"}
                                      </span>
                                    )}

                                    {isOwner && (
                                      <button
                                        onClick={() => handleDeleteSubtask(st.id)}
                                        style={{ background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline "+ Create New Task" Modal */}
      {showTaskModal && (
        <div className="modal-backdrop" style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(15,23,42,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", padding: "24px", maxWidth: "600px", width: "90%", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button
              onClick={() => setShowTaskModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b" }}
            >
              ✕
            </button>

            <h3 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>Create New Group Task</h3>

            <form onSubmit={handleCreateTaskFromModal} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>Task Title *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter task title..."
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  required
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>Description</label>
                <textarea
                  className="form-input"
                  placeholder="Task details..."
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  style={{ width: "100%", minHeight: "80px", resize: "vertical" }}
                />
              </div>

              {/* Subtasks Builder */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "6px" }}>Subtasks</label>
                {modalSubtasks.map((st, index) => (
                  <div key={index} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Subtask ${index + 1}`}
                      value={st}
                      onChange={(e) => handleSubtaskChange(index, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {modalSubtasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtaskField(index)}
                        style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5", borderRadius: "8px", padding: "0 12px", cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddSubtaskField}
                  style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", marginTop: "4px" }}
                >
                  + Add Subtask
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#f1f5f9", color: "#475569", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gradient-primary">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  </div>
);}