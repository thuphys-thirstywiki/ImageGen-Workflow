export type Proposal = {
  id: string;
  title: string;
  prompt: string;
  /** refine = 在现有基础上改进；rework = 大改一版 */
  kind?: "refine" | "rework";
};

export type Critique = {
  /** Brief overall note; secondary to actionable suggestions. */
  summary: string;
  improvements: string[];
  proposals: Proposal[];
};

export type Iteration = {
  id: string;
  prompt: string;
  imagePath: string;
  critique?: Critique;
  /** generate = 文生图；upload = 用户粘贴/上传后直接评审 */
  source?: "generate" | "upload";
  createdAt: string;
};

export type Session = {
  id: string;
  title: string;
  /** High-level brief for the design task; included in model context. */
  description: string;
  /** Display name of the person who created / owns this task. */
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  iterations: Iteration[];
};

export type SessionSummary = {
  id: string;
  title: string;
  description: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  iterationCount: number;
  latestImagePath?: string;
};
