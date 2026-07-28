// src/api/splitBill.js
import api from "./axios"; // Aap ki existing axios instance

// 1. Group APIs
export const fetchMyGroups = () => api.get("split-groups/");

export const createGroup = async (groupData) => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('access');
  
  // Custom API instance automatically interceptor se token attach kar dega ya manually dein:
  return await api.post('/split-groups/', groupData, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

// 2. Invite APIs
export const fetchPendingInvites = () => api.get("split-groups/my-invites/");
export const sendGroupInvite = (groupId, username) =>
  api.post(`split-groups/${groupId}/send-invite/`, { user_identifier: username });
export const respondToInvite = (inviteId, action) =>
  api.post(`split-groups/invites/${inviteId}/respond/`, { action });

// 3. Expense & Settlement APIs
export const addGroupExpense = (groupId, data) =>
  api.post(`split-groups/${groupId}/expenses/`, data);
export const fetchGroupBalances = (groupId) =>
  api.get(`split-groups/${groupId}/balances/`);
export const recordSettlement = (data) =>
  api.post("split-groups/settle/", data);