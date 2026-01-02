import React, { useState, useEffect } from 'react';
import { Save, Shield, Database, Key, Trash2 } from 'lucide-react';

export function Settings() {
  const [shoonyaConfig, setShoonyaConfig] = useState({
    userId: '',
    password: '',
    twoFA: '',
    vendorCode: '',
    apiKey: '',
    imei: 'abc1234'
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    fetch('/api/shoonya/config')
      .then(res => res.json())
      .then(data => {
        if (data.userId) setShoonyaConfig(data);
      });
  }, []);

  const handleClearCache = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000); // Reset after 3s
      return;
    }
    
    setClearing(true);
    setConfirmClear(false);
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' });
      if (res.ok) {
        alert('Cache cleared successfully!');
      } else {
        alert('Failed to clear cache.');
      }
    } catch (e) {
      alert('Network error clearing cache.');
    }
    setClearing(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // Save first to ensure server has latest config
      await fetch('/api/shoonya/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shoonyaConfig)
      });

      const res = await fetch('/api/shoonya/test');
      const data = await res.json();
      
      if (data.success) {
        alert(`✅ Connection Successful!\nToken: ${data.token.substring(0, 10)}...`);
      } else {
        alert(`❌ Connection Failed:\n${data.error}`);
      }
    } catch (e: any) {
      alert(`❌ Network Error: ${e.message}`);
    }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/shoonya/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shoonyaConfig)
      });
      alert('Settings saved successfully!');
    } catch (e) {
      alert('Failed to save settings');
    }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-[98%] mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
      <p className="text-slate-600 mb-8">Configure data sources and system preferences.</p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Data Source: Shoonya (Finvasia)</h3>
            <p className="text-xs text-slate-500">Configure your broker API for reliable data fetching.</p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">User ID</label>
            <input
              type="text"
              value={shoonyaConfig.userId}
              onChange={e => setShoonyaConfig({ ...shoonyaConfig, userId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="FA12345"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={shoonyaConfig.password}
              onChange={e => setShoonyaConfig({ ...shoonyaConfig, password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">2FA (TOTP Secret or DOB)</label>
            <input
              type="password"
              value={shoonyaConfig.twoFA}
              onChange={e => setShoonyaConfig({ ...shoonyaConfig, twoFA: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="TOTP Secret or DD-MM-YYYY"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Code</label>
            <input
              type="text"
              value={shoonyaConfig.vendorCode}
              onChange={e => setShoonyaConfig({ ...shoonyaConfig, vendorCode: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="FA12345_U"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">API Key (App Key)</label>
            <input
              type="password"
              value={shoonyaConfig.apiKey}
              onChange={e => setShoonyaConfig({ ...shoonyaConfig, apiKey: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
              placeholder="32-char API Key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">IMEI (Optional)</label>
            <input
              type="text"
              value={shoonyaConfig.imei}
              onChange={e => setShoonyaConfig({ ...shoonyaConfig, imei: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="abc1234"
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg font-medium transition-colors disabled:opacity-50 mr-auto ${
              confirmClear 
                ? 'bg-red-600 text-white border-red-700 hover:bg-red-700' 
                : 'bg-white border-red-200 text-red-600 hover:bg-red-50'
            }`}
          >
            {clearing ? 'Clearing...' : confirmClear ? 'Are you sure?' : (
              <>
                <Trash2 className="w-4 h-4" /> Clear Cache
              </>
            )}
          </button>

          <button
            onClick={handleTest}
            disabled={testing || saving}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {testing ? 'Testing...' : (
              <>
                <Shield className="w-4 h-4" /> Test Connection
              </>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : (
              <>
                <Save className="w-4 h-4" /> Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
