/**
 * Admin Portal - Single Entry Point
 * 
 * Unified admin interface with:
 * - Unlock modal with diagnostics
 * - System Health tab
 * - Knowledge Vault tab
 * - Audit Log tab
 */

import React, { useState, useEffect } from 'react';
import { useAdminStore } from '../store/adminStore';
import { AdminUnlockModal } from './admin/AdminUnlockModal';
import { SystemHealthTab } from './admin/SystemHealthTab';
import { KnowledgeVaultTab } from './admin/KnowledgeVaultTab';
import { AuditLogTab } from './admin/AuditLogTab';
import { GameLogsTab } from './admin/GameLogsTab';
import { CoachEngineTest } from './CoachEngineTest';
import { WorkerCallsTab } from './admin/WorkerCallsTab';
import { LearningDiagnosticsTab } from './admin/LearningDiagnosticsTab';
import './AdminPortal.css';

type Tab = 'health' | 'vault' | 'audit' | 'logs' | 'coach' | 'worker' | 'learning';

export const AdminPortal: React.FC = () => {
  const { isAuthenticated, isSessionValid, clearSession } = useAdminStore();
  const [activeTab, setActiveTab] = useState<Tab>('health');
  const [showUnlock, setShowUnlock] = useState(true);

  useEffect(() => {
    // Check if session is still valid
    if (isAuthenticated && !isSessionValid()) {
      clearSession();
      setShowUnlock(true);
    }
  }, [isAuthenticated, isSessionValid, clearSession]);

  const handleUnlocked = () => {
    setShowUnlock(false);
  };

  const handleLogout = () => {
    clearSession();
    setShowUnlock(true);
    setActiveTab('health');
  };

  if (showUnlock || !isAuthenticated) {
    return <AdminUnlockModal onUnlocked={handleUnlocked} />;
  }

  return (
    <div className="admin-portal">
      <div className="admin-header">
        <h1>ChessChat Admin Portal</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          System Health
        </button>
        <button
          className={`tab-button ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          Knowledge Vault
        </button>
        <button
          className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Log
        </button>
        <button
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          🎮 Game Logs
        </button>
        <button
          className={`tab-button ${activeTab === 'coach' ? 'active' : ''}`}
          onClick={() => setActiveTab('coach')}
        >
          🧠 CoachEngine
        </button>
        <button
          className={`tab-button ${activeTab === 'worker' ? 'active' : ''}`}
          onClick={() => setActiveTab('worker')}
        >
          🔗 Worker Calls
        </button>
        <button
          className={`tab-button ${activeTab === 'learning' ? 'active' : ''}`}
          onClick={() => setActiveTab('learning')}
        >
          🤖 Wall-E Learning
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'health' && <SystemHealthTab />}
        {activeTab === 'vault' && <KnowledgeVaultTab />}
        {activeTab === 'audit' && <AuditLogTab />}
        {activeTab === 'logs' && <GameLogsTab />}
        {activeTab === 'coach' && <CoachEngineTest />}
        {activeTab === 'worker' && <WorkerCallsTab />}
        {activeTab === 'learning' && <LearningDiagnosticsTab />}
      </div>
    </div>
  );
};
