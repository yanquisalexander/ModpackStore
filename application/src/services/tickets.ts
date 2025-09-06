import { API_ENDPOINT } from "@/consts";

// Type definitions for tickets
export interface TicketMessage {
  id: string;
  content: string;
  isStaffMessage: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
  };
}

export interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'in_review' | 'closed';
  ticketNumber: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  messages?: TicketMessage[];
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface CreateTicketRequest {
  subject: string;
  content: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface UpdateStatusRequest {
  status: 'open' | 'in_review' | 'closed';
}

// Helper function to get auth headers
const getAuthHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.api+json',
  'Authorization': `Bearer ${token}`
});

// User ticket services
export const createTicket = async (request: CreateTicketRequest, token: string): Promise<Ticket> => {
  const response = await fetch(`${API_ENDPOINT}/tickets`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to create ticket: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data.attributes;
};

export const getUserTickets = async (token: string): Promise<Ticket[]> => {
  const response = await fetch(`${API_ENDPOINT}/tickets`, {
    method: 'GET',
    headers: getAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tickets: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data.map((item: any) => item.attributes);
};

export const getTicket = async (ticketId: string, token: string): Promise<Ticket> => {
  const response = await fetch(`${API_ENDPOINT}/tickets/${ticketId}`, {
    method: 'GET',
    headers: getAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ticket: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data.attributes;
};

export const sendMessage = async (ticketId: string, request: SendMessageRequest, token: string): Promise<TicketMessage> => {
  const response = await fetch(`${API_ENDPOINT}/tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data.attributes;
};

// Admin ticket services
export const getAllTickets = async (token: string, status?: string): Promise<Ticket[]> => {
  const url = new URL(`${API_ENDPOINT}/admin/tickets`);
  if (status) {
    url.searchParams.append('status', status);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: getAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch admin tickets: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data.map((item: any) => item.attributes);
};

export const getAdminTicket = async (ticketId: string, token: string): Promise<Ticket> => {
  const response = await fetch(`${API_ENDPOINT}/admin/tickets/${ticketId}`, {
    method: 'GET',
    headers: getAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch admin ticket: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data.attributes;
};

export const sendAdminMessage = async (ticketId: string, request: SendMessageRequest, token: string): Promise<TicketMessage> => {
  const response = await fetch(`${API_ENDPOINT}/admin/tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to send admin message: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data.attributes;
};

export const updateTicketStatus = async (ticketId: string, request: UpdateStatusRequest, token: string): Promise<void> => {
  const response = await fetch(`${API_ENDPOINT}/admin/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to update ticket status: ${response.statusText}`);
  }
};

export const markMessagesAsRead = async (ticketId: string, token: string): Promise<void> => {
  const response = await fetch(`${API_ENDPOINT}/admin/tickets/${ticketId}/mark-read`, {
    method: 'PATCH',
    headers: getAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Failed to mark messages as read: ${response.statusText}`);
  }
};