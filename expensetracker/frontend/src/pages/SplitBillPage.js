import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Navigation ke liye
import api from "../api/axios";
import { 
  fetchMyGroups, 
  fetchPendingInvites, 
  respondToInvite, 
  createGroup,
  sendGroupInvite,
  addGroupExpense,
  fetchGroupBalances,
  recordSettlement
} from "../api/splitBill";

export default function SplitBillPage({ currentUser }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [invites, setInvites] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupType, setGroupType] = useState("Trip");
  const [inviteUsername, setInviteUsername] = useState("");
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [balances, setBalances] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsRes, invitesRes] = await Promise.all([
        fetchMyGroups().catch(() => ({ data: [] })),
        fetchPendingInvites().catch(() => ({ data: [] })),
      ]);

      const gData = groupsRes.data?.results || groupsRes.data || [];
      const iData = invitesRes.data?.results || invitesRes.data || [];

      setGroups(Array.isArray(gData) ? gData : []);
      setInvites(Array.isArray(iData) ? iData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCalculateBalances = async (groupId) => {
    try {
      const targetId = groupId || activeGroup?.id;
      if (!targetId) return;
      const res = await fetchGroupBalances(targetId);
      setBalances(res.data);
    } catch (err) {
      console.error("Failed to calculate balances", err);
    }
  };

  const handleOpenGroup = (group) => {
    setActiveGroup(group);
    setBalances(null);
    setPaidBy(currentUser?.id || group.members?.[0]?.user?.id || "");
    handleCalculateBalances(group.id);
  };

  const handleInviteAction = async (inviteId, action) => {
    try {
      await respondToInvite(inviteId, action);
      alert(`Invite ${action.toLowerCase()}ed!`);
      loadData();
    } catch (err) {
      alert("Failed to update invite");
    }
  };

  const handleLeaveGroup = async (groupId, e) => {
  if (e) e.stopPropagation();
  
  if (!window.confirm("Are you sure you want to leave this group?")) {
    return;
  }

  try {
    // 🟢 Fetch ki bajaye 'api' (axios) use karein
    const response = await api.post(`/split-groups/${groupId}/leave/`);

    alert("You have left the group successfully!");
    setActiveGroup(null);
    loadData();
  } catch (err) {
    console.error("Error leaving group:", err.response || err);
    alert(err.response?.data?.error || err.response?.data?.detail || "Failed to leave group (Check URL endpoint or Backend)");
  }
};

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName) return;
    try {
      await createGroup({ name: newGroupName, group_type: groupType });
      setNewGroupName("");
      loadData();
    } catch (err) {
      alert("Error creating group");
    }
  };

 
  const handleDeleteGroup = async (groupId, e) => {
  if (e) e.stopPropagation();
  
  if (!window.confirm("Are you sure you want to delete this group? All expenses will be lost!")) return;

  try {
    
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");

    await api.delete(`/split-groups/${groupId}/`, {
      headers: {
        Authorization: `Bearer ${token}`, // Header explicitly attach karein
      }
    });

    alert("Group deleted successfully!");
    if (activeGroup?.id === groupId) {
      setActiveGroup(null);
    }
    loadData(); // List refresh karein
  } catch (err) {
    console.error("Delete Group Error:", err.response);
    if (err.response?.status === 403) {
      alert("Permission Error: Please log in again or check user authentication.");
    } else {
      alert("Failed to delete group!");
    }
  }
};
  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteUsername) return;
    try {
      await sendGroupInvite(activeGroup.id, inviteUsername);
      alert(`Invitation sent to @${inviteUsername}`);
      setInviteUsername("");
    } catch (err) {
      alert(err.response?.data?.error || "User not found or already invited!");
    }
  };

const handleAddExpense = async (e) => {
  e.preventDefault();
  if (!expTitle || !expAmount) return;

  try {
    const membersList = activeGroup?.members || [];
    const total = parseFloat(expAmount);
    const splitValue = membersList.length > 0 ? total / membersList.length : total;

    // 🟢 SAFELY EXTRACT USER ID (Har case mein User ID extract hoga, GroupMember ID nahi)
    const splitsPayload = membersList.map((member) => {
      // Direct user object ho, ya inner user ID ho, ya object fallback
      const resolvedUserId = typeof member.user === 'object' 
        ? member.user?.id 
        : (member.user || member.user_id || member.id);

      return {
        user_id: parseInt(resolvedUserId),
        value: splitValue,
        amount_owed: splitValue,
      };
    });

    // Payer ID extract karne ke liye bhi exact fallback:
    // const selectedMember = membersList.find((m) => {
    //   const mUserId = typeof m.user === 'object' ? m.user?.id : (m.user || m.user_id || m.id);
    //   return String(mUserId) === String(paidBy);
    // });

    // const resolvedPayerId = selectedMember 
    //   ? (typeof selectedMember.user === 'object' ? selectedMember.user?.id : (selectedMember.user || selectedMember.user_id))
    //   : (paidBy || currentUser?.id);

    const payload = {
      title: expTitle,
      total_amount: total,
      paid_by: currentUser?.id,
      split_type: "EQUAL",
      description: `Expense for ${expTitle}`,
      splits: splitsPayload,
    };

    await addGroupExpense(activeGroup.id, payload);

    setExpTitle("");
    setExpAmount("");
    await handleCalculateBalances(activeGroup.id);
    alert("Expense added successfully!");

  } catch (err) {
    console.error("Add Expense Error:", err.response?.data || err);
    alert(err.response?.data?.error || "Failed to add expense");
  }
};

  const handleSettleTransaction = async (settlement) => {
    try {
      await recordSettlement({
        group: activeGroup.id,
        payer: settlement.from_user_id,
        payee: settlement.to_user_id,
        amount: settlement.amount,
        is_settled: true
      });
      alert("Expense settled successfully!");
      await handleCalculateBalances(activeGroup.id);
    } catch (err) {
      console.error("Settlement Error:", err);
      alert("Failed to settle transaction");
    }
  };

  if (loading) return <div className="empty-state">Loading Split Bill Page...</div>;

  return (
    <div className="split-bill-page-container" style={{ padding: "1.5rem" }}>
      
      {/* 🟢 VIEW 1: ACTIVE GROUP DETAIL SCREEN */}
      {activeGroup ? (
        <div className="panel glass" style={{ maxWidth: "900px", margin: "0 auto" }}>
          
          {/* 🔝 TOP BAR ACTIONS */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <button 
              onClick={() => { setActiveGroup(null); loadData(); }} 
              className="btn-secondary"
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer" }}
            >
              ← Back to All Groups
            </button>

            {/* 👑 OWNER: Delete Button | 👤 MEMBER: Leave Button */}
            {activeGroup.is_owner ? (
              <button 
                onClick={(e) => handleDeleteGroup(activeGroup.id, e)}
                style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid #ef4444", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
              >
                🗑️ Delete Group
              </button>
            ) : (
              <button 
                onClick={(e) => handleLeaveGroup(activeGroup.id, e)}
                style={{ background: "rgba(249, 115, 22, 0.2)", color: "#f97316", border: "1px solid #f97316", padding: "0.4rem 0.8rem", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
              >
                🚪 Leave Group
              </button>
            )}
          </div>

          {/* GROUP HEADER */}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>{activeGroup.name}</h2>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Type: {activeGroup.group_type}</span>
          </div>

          {/* 🟢 INVITE SECTION (ONLY FOR OWNER) */}
          {activeGroup.is_owner && (
            <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Invite Friend by Username</h3>
              
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input 
                  type="text" 
                  placeholder="Enter valid username (e.g. ahmed123)..."
                  value={inviteUsername || ''} 
                  onChange={(e) => setInviteUsername(e.target.value)}
                  style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
                />
                <button 
                  onClick={handleSendInvite}
                  style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Send Invite
                </button>
              </div>

              {/* 📋 SENT INVITES STATUS TRACKER */}
              {activeGroup.invites && activeGroup.invites.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "0.8rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.5rem" }}>Invites Status:</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {activeGroup.invites.map((inv) => (
                      <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.3)", padding: "0.4rem 0.8rem", borderRadius: "5px", fontSize: "0.85rem" }}>
                        <span>@{inv.receiver_username}</span>
                        <span style={{ 
                          padding: "0.1rem 0.5rem", 
                          borderRadius: "4px", 
                          fontSize: "0.75rem", 
                          fontWeight: "bold",
                          background: inv.status === 'ACCEPTED' ? 'rgba(34, 197, 94, 0.2)' : inv.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                          color: inv.status === 'ACCEPTED' ? '#22c55e' : inv.status === 'REJECTED' ? '#ef4444' : '#eab308',
                          border: `1px solid ${inv.status === 'ACCEPTED' ? '#22c55e' : inv.status === 'REJECTED' ? '#ef4444' : '#eab308'}`
                        }}>
                          {inv.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rest of Expense inputs & calculation results go here... */}

          {/* FORM 1: INVITE USER BY USERNAME */}
          <div style={{ marginTop: "1.5rem", background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>Invite Friend by Username</h4>
            <form onSubmit={handleSendInvite} style={{ display: "flex", gap: "0.5rem" }}>
              <input 
                type="text" 
                placeholder="Enter valid username (e.g. ahmed123)..."
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "#fff" }}
                required
              />
              <button type="submit" style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                Send Invite
              </button>
            </form>
          </div>

          {/* FORM 2: ADD CONTRIBUTION */}
          <div style={{ marginTop: "1.5rem", background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>Add Contribution / Spent Expense</h4>
            <form onSubmit={handleAddExpense} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.5rem" }}>
              <input 
                type="text" 
                placeholder="Where spent? (e.g. Hotel, Bus)"
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "#fff" }}
                required
              />
              <input 
                type="number" 
                placeholder="Amount (Rs)"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                style={{ padding: "0.5rem", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "#fff" }}
                required
              />
              
            <div 
              style={{ 
                padding: "0.5rem 0.8rem", 
                borderRadius: "6px", 
                border: "1px solid rgba(255,255,255,0.2)", 
                background: "rgba(0,0,0,0.3)", 
                color: "#fff",
                display: "flex",
                alignItems: "center",
                fontSize: "0.9rem",
                whiteSpace: "nowrap"
              }}
            >
              Paid by {currentUser?.username || "You"}
            </div>
              <button type="submit" style={{ background: "#10b981", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
                + Add
              </button>
            </form>
          </div>

          {/* CALCULATIONS & WHO OWES WHOM SECTION */}
          {balances && (
            <div style={{ marginTop: "1.5rem", background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.3)", padding: "1.2rem", borderRadius: "10px" }}>
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#c084fc" }}>📊 Calculation Results (You'll see the result once the invite gets accepted)</h3>

              <p style={{ margin: "0 0 1rem 0", fontSize: "0.95rem" }}>
                Your Net Balance: <strong style={{ color: Number(balances.my_net_balance) >= 0 ? "#10b981" : "#ef4444" }}>
                  Rs {balances.my_net_balance}
                </strong>
              </p>

              <h4 style={{ margin: "1rem 0 0.5rem 0", fontSize: "0.9rem" }}>Minimized Settlement (Who Owes Whom):</h4>
              {balances.who_owes_whom?.length === 0 ? (
                <p style={{ color: "#10b981", fontSize: "0.85rem" }}>Everyone is settled up!</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {balances?.who_owes_whom?.map((s, idx) => {
                    console.log("Current User ID:", currentUser?.id, "Settle From ID:", s.from_user_id, "Settle From Username:", s.from_username, "Logged Username:", currentUser?.username);
                    const isPayer = 
                      String(s.from_user_id || s.from_user || "").trim() === String(currentUser?.id || "").trim() ||
                      String(s.from_username || "").toLowerCase().replace("@", "") === String(currentUser?.username || "").toLowerCase().replace("@", "");

                    return (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)", padding: "0.6rem 1rem", borderRadius: "6px" }}>
                        
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "0.88rem" }}>
                            <strong>@{s.from_username}</strong> has to pay <strong>@{s.to_username}</strong>: <strong style={{ color: "#ef4444" }}>Rs {s.amount}</strong>
                          </span>
                          {s.expense_titles && (
                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>
                              For: {s.expense_titles}
                            </span>
                          )}
                        </div>

                        <button 
                          onClick={() => handleSettleTransaction(s)}
                          disabled={!isPayer}
                          style={{ 
                            background: isPayer ? "#6366f1" : "#4b5563", 
                            color: isPayer ? "#fff" : "#9ca3af", 
                            border: "none", 
                            padding: "0.4rem 0.8rem", 
                            borderRadius: "4px", 
                            fontWeight: "bold", 
                            cursor: isPayer ? "pointer" : "not-allowed", 
                            fontSize: "0.8rem",
                            opacity: isPayer ? 1 : 0.65,
                            transition: "all 0.2s ease"
                          }}
                        >
                          {isPayer ? "OK / Settle Expense" : "Awaiting Payment"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      ) : (

        /* 🔴 VIEW 2: MAIN SPLIT BILL GROUPS LIST & PENDING INVITES */
        <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Back to Main Dashboard Button */}
          <div>
            <button 
              onClick={() => navigate("/")} 
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* PENDING INVITATIONS BANNER */}
          {invites.length > 0 && (
            <div className="panel glass" style={{ borderLeft: "4px solid #f59e0b" }}>
              <div className="panel-title" style={{ color: "#f59e0b" }}>
                📩 Pending Group Invitations ({invites.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.8rem" }}>
                {invites.map((inv) => (
                  <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.05)", padding: "0.8rem", borderRadius: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "1rem" }}>{inv.group_name}</strong>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Invited by @{inv.sender_detail?.username}</div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button 
                        onClick={() => handleInviteAction(inv.id, "ACCEPT")}
                        style={{ background: "#10b981", color: "#fff", border: "none", padding: "0.4rem 1rem", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleInviteAction(inv.id, "REJECT")}
                        style={{ background: "#ef4444", color: "#fff", border: "none", padding: "0.4rem 1rem", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GROUPS CONTAINER */}
          <div className="panel glass">
            <div className="panel-title">🤝 Split Bill Groups ({groups.length})</div>

            {/* CREATE GROUP FORM */}
            <form onSubmit={handleCreateGroup} style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
              <input 
                type="text" 
                placeholder="Group Name (e.g. Northern Trip)" 
                value={newGroupName} 
                onChange={(e) => setNewGroupName(e.target.value)} 
                style={{ flex: 1, padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.2)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
                required
              />
              <select 
                value={groupType} 
                onChange={(e) => setGroupType(e.target.value)}
                style={{ padding: "0.6rem 1rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.2)", background: "rgba(0,0,0,0.2)", color: "#fff" }}
              >
                <option value="Trip" style={{ color: "#000" }}>Trip</option>
                <option value="Home" style={{ color: "#000" }}>Home / Flat</option>
                <option value="Couple" style={{ color: "#000" }}>Couple</option>
                <option value="Event" style={{ color: "#000" }}>Event</option>
                <option value="Other" style={{ color: "#000" }}>Other</option>
              </select>
              <button 
                type="submit" 
                style={{ background: "#6366f1", color: "#fff", border: "none", padding: "0.6rem 1.2rem", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
              >
                + Create Group
              </button>
            </form>

            {/* GROUPS LIST */}
            {groups.length === 0 ? (
              <div className="empty-state">No split bill groups yet. Create one above!</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
                {groups.map((g) => (
                  <div 
                    key={g.id} 
                    onClick={() => handleOpenGroup(g)}
                    style={{ background: "rgba(255, 255, 255, 0.05)", padding: "1rem", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.1)", cursor: "pointer", position: "relative" }}
                  >
                    <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#fff" }}>{g.name}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.3rem" }}>
                      {g.members?.length || 1} members · {g.group_type}
                    </div>

                    <div style={{ marginTop: "0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.85rem", color: "#818cf8", fontWeight: "bold" }}>
                        Open Group →
                      </span>
                      {/* Delete Option on Group Card */}
                      <button 
                        onClick={(e) => handleDeleteGroup(g.id, e)}
                        title="Delete Group"
                        style={{ background: "transparent", color: "#ef4444", border: "none", cursor: "pointer", fontSize: "0.9rem" }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}