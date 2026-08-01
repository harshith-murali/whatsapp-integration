import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { Layout } from "./components/Layout.js";
import { Login } from "./pages/Login.js";
import { SignUp } from "./pages/SignUp.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Subscribers } from "./pages/Subscribers.js";
import { Groups } from "./pages/Groups.js";
import { Broadcasts } from "./pages/Broadcasts.js";
import { BroadcastDetails } from "./pages/BroadcastDetails.js";
import { Messages } from "./pages/Messages.js";
import { AdminManagement } from "./pages/AdminManagement.js";
import { Settings } from "./pages/Settings.js";
import { Unauthorized } from "./pages/Unauthorized.js";
import { NotFound } from "./pages/NotFound.js";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Protected Routes inside Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="subscribers" element={<Subscribers />} />
            
            <Route
              path="groups"
              element={
                <ProtectedRoute permission="groups.view">
                  <Groups />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="broadcasts"
              element={
                <ProtectedRoute permission="broadcasts.view">
                  <Broadcasts />
                </ProtectedRoute>
              }
            />

            <Route
              path="broadcasts/:id"
              element={
                <ProtectedRoute permission="broadcasts.view">
                  <BroadcastDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="messages"
              element={
                <ProtectedRoute permission="messages.view">
                  <Messages />
                </ProtectedRoute>
              }
            />

            <Route
              path="admins"
              element={
                <ProtectedRoute permission="admins.view">
                  <AdminManagement />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="settings"
              element={
                <ProtectedRoute permission="settings.manage">
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route path="unauthorized" element={<Unauthorized />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
