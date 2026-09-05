// Shapes shared by the server cache, the tRPC router, and the client.
export interface RosterStudent {
  id: number;
  name: string;
  sortableName: string; // "Last, First" as Canvas reports it
  email: string;
}

export interface RosterGroupMember {
  id: number;
  sortableName: string;
}

export interface RosterGroup {
  id: number;
  name: string;
  members: RosterGroupMember[];
}

export interface RosterGroupSet {
  id: number;
  name: string;
  groups: RosterGroup[];
}

export interface StudentsSnapshot {
  students: RosterStudent[];
  syncedAt: string; // ISO
}

export interface GroupSetsSnapshot {
  groupSets: RosterGroupSet[];
  syncedAt: string; // ISO
}
