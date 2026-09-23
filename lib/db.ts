import { validateWorkspaceReferences } from "./workspace-references";
import { basePrisma } from "./db-base";
import { getWorkspace } from "./workspace";
import { scopeQuery } from "./workspace-scope";

export const prisma = basePrisma.$extends({
  name: "workspace-isolation",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (model === "AdminUser") return query(args);
        if (model === "Workspace") throw new Error("Use the workspace management API");
        const workspace = await getWorkspace();
        const scoped = scopeQuery(model, operation, args, workspace.id);
        await validateWorkspaceReferences(model, operation, scoped, workspace.id);
        return query(scoped);
      },
    },
  },
});
