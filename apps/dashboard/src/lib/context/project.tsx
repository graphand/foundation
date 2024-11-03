"use client";

import { createContext, useContext } from "react";

interface ProjectContextType {
  projectSubdomain: string;
  environment: string;
}

const ProjectContext = createContext<ProjectContextType>({
  projectSubdomain: "",
  environment: "master",
});

export function ProjectProvider({
  children,
  projectSubdomain,
  environment,
}: ProjectContextType & { children: React.ReactNode }) {
  return <ProjectContext.Provider value={{ projectSubdomain, environment }}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
