export type Proposal = {
  id: string;
  title: string;
  prompt: string;
};

export type Critique = {
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
  /** Display name of the person who created / owns this task. */
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  iterations: Iteration[];
};

export type SessionSummary = {
  id: string;
  title: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  iterationCount: number;
  latestImagePath?: string;
};
