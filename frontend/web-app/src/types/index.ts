// ── Core Platform Types ───────────────────────────────────────────────────────

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type AIEngine = 'apix' | 'uix' | 'integrationx' | 'mobile_ai' | 'mee' | 'agent_developer' | 'legacy_converter' | 'business_extractor' | 'ai_planning'
export type AIJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying'
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type RequirementStatus = 'draft' | 'reviewed' | 'approved' | 'linked' | 'deprecated'
export type DeploymentEnvironment = 'dev' | 'staging' | 'prod'
export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed' | 'rolled_back'
export type UserRole = 'project_manager' | 'developer' | 'qa_engineer' | 'devops_engineer' | 'business_stakeholder' | 'system_admin'

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  tenant_id: string
  is_active: boolean
  mfa_enabled: boolean
  created_at: string
}

export interface TokenClaims {
  sub: string
  email: string
  tenant_id: string
  roles: string[]
  permissions: string[]
  exp: number
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  tech_stack: string[]
  repository_url?: string
  owner_id: string
  tenant_id: string
  created_at: string
  updated_at: string
}

// ── Requirements ──────────────────────────────────────────────────────────────

export interface Requirement {
  id: string
  project_id: string
  title: string
  description: string
  acceptance_criteria: string[]
  priority: Priority
  status: RequirementStatus
  source_req_id?: string
  version: number
  ai_generated: boolean
  created_by: string
  created_at: string
  updated_at: string
}

// ── Backlog ───────────────────────────────────────────────────────────────────

export interface BacklogItem {
  id: string
  project_id: string
  sprint_id?: string
  requirement_id?: string
  title: string
  description: string
  acceptance_criteria: string[]
  priority: Priority
  story_points?: number
  status: 'backlog' | 'in_sprint' | 'in_progress' | 'done'
  ai_generated: boolean
}

export interface Sprint {
  id: string
  project_id: string
  name: string
  goal?: string
  start_date: string
  end_date: string
  capacity_points?: number
  status: 'planned' | 'active' | 'completed'
}

// ── AI Jobs ───────────────────────────────────────────────────────────────────

export interface AIJob {
  id: string
  engine: AIEngine
  project_id: string
  requirement_id?: string
  status: AIJobStatus
  priority: Priority
  trigger_source: string
  attempt_count: number
  created_at: string
  started_at?: string
  completed_at?: string
  error_message?: string
}

// ── MEE ───────────────────────────────────────────────────────────────────────

export interface ActivityFeedEntry {
  id: string
  agent_id: string
  action_type: string
  project_id: string
  status: 'started' | 'completed' | 'failed'
  duration_ms?: number
  timestamp: string
}

export interface Anomaly {
  id: string
  project_id: string
  agent_id: string
  anomaly_type: 'repeated_failure' | 'unexpected_output' | 'performance_degradation' | 'unusual_pattern'
  severity: Priority
  description: string
  detected_at: string
  resolved: boolean
}

// ── Deployments ───────────────────────────────────────────────────────────────

export interface Deployment {
  id: string
  project_id: string
  environment: DeploymentEnvironment
  status: DeploymentStatus
  version: string
  triggered_by: string
  started_at?: string
  completed_at?: string
  rollback_of?: string
}

export interface ApprovalGate {
  id: string
  deployment_id: string
  environment: string
  status: 'pending' | 'approved' | 'rejected'
  requested_by: string
  created_at: string
}

// ── Agents ────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string
  name: string
  description: string
  owner_id: string
  tenant_id: string
  status: 'draft' | 'generating' | 'testing' | 'deployed' | 'deprecated'
  capabilities: string[]
  tools: string[]
  version: number
  mee_enabled: boolean
  created_at: string
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  project_id: string
  active_sprint?: Sprint
  open_requirements: number
  ai_jobs_running: number
  test_pass_rate: number
  deployment_frequency: number
  ai_tasks_this_week: number
  velocity_trend: 'increasing' | 'stable' | 'decreasing'
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
