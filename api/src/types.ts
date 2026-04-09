export type UserRole = "admin" | "test_lead" | "tester";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMember {
  uid: string;
  email: string;
  role: UserRole;
  addedAt: number;
}

export interface ProjectParameter {
  key: string;
  value: string;
}

export interface ProjectDoc {
  id: string;
  name: string;
  description: string;
  parameters: ProjectParameter[];
  nextCaseNumber?: number;
  nextRunTestNumber?: number;
  memberIds: string[];
  members: ProjectMember[];
  testCasePriorityOptions?: string[];
  testCaseTypeOptions?: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}
