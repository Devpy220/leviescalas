import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyDepartments from "./tools/list-my-departments";
import listMySchedules from "./tools/list-my-schedules";
import listAnnouncements from "./tools/list-announcements";

// Direct Supabase host is required for the OAuth issuer (see app-mcp-server-authoring).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "levi-escalas-mcp",
  title: "LEVI Escalas",
  version: "0.1.0",
  instructions:
    "Ferramentas do LEVI (leviescalas.com.br) para consultar escalas, departamentos e avisos da igreja do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyDepartments, listMySchedules, listAnnouncements],
});
