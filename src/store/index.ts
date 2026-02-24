import { configureStore } from "@reduxjs/toolkit";
import { opencodeSlice } from "./slices/opencodeSlice";
import { sessionsSlice } from "./slices/sessionsSlice";
import { messagesSlice } from "./slices/messagesSlice";
import { workspaceSlice } from "./slices/workspaceSlice";
import { modelOptionsSlice } from "./slices/modelOptionsSlice";
import { skillsSlice } from "./slices/skillsSlice";

export const store = configureStore({
  reducer: {
    opencode: opencodeSlice.reducer,
    sessions: sessionsSlice.reducer,
    messages: messagesSlice.reducer,
    workspace: workspaceSlice.reducer,
    modelOptions: modelOptionsSlice.reducer,
    skills: skillsSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredPaths: ["opencode.client"],
        ignoredActionPaths: ["payload.client"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
