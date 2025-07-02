export interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: "starter" | "pro" | "enterprise";
  trial_days?: number;
  avatar?: string;
}

export interface Stats {
  total_contacts: number;
  messages_sent: number;
  response_rate: number;
  meetings_scheduled: number;
  monthly_revenue: number;
  active_campaigns: number;
}

export interface Activity {
  id: string;
  type: "cobranca" | "sdr" | "meeting" | "payment" | "campaign";
  message: string;
  time: string;
  status: "success" | "warning" | "error" | "info";
  metadata?: any;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  status: "active" | "inactive" | "blocked";
  tags: string[];
  last_contact?: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: "cobranca" | "sdr" | "nurturing";
  status: "active" | "paused" | "draft" | "completed";
  contacts_count: number;
  sent_count: number;
  response_rate: number;
  created_at: string;
}
