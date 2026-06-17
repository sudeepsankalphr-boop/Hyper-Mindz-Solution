'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://hyper-mindz-solution-production.up.railway.app';
const COLORS = ['#00d4aa', '#0066ff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'];

function getToken() { return localStorage.getItem('token'); }
function authHeaders() { return { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' }; }

export default function Dashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [chartType, setChartType] = useState<'table' | 'bar' | 'line' | 'pie'>('table');
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const res = await fetch(`${API}/files/list`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!res.ok) { router.push('/login'); return; }
      setFiles(await res.json());
    } catch { setError('Could not load files'); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/files/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${getToken()}` }, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      await loadFiles();
    } catch (err: any) { setError(err.message); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await fetch(`${API}/files/${fileId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (selectedFile?.file_id === fileId) setSelectedFile(null);
      await loadFiles();
    } catch { setError('Delete failed'); }
  };

  const handleSelectFile = async (file: any) => {
    try {
      const res = await fetch(`${API}/files/${file.file_id}`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
      const data = await res.json();
      setSelectedFile(data); setResult(null); setQuestion(''); setHistory([]);
    } catch { setError('Could not load file details'); }
  };

  const handleQuery = async () => {
    if (!selectedFile || !question.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API}/query/ask`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ file_id: selectedFile.file_id, question }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Query failed');
      setResult(data); setChartType('table');
      setHistory(prev => [{ question, sql: data.sql, rows: data.data?.count }, ...prev.slice(0, 9)]);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleLogout = () => { localStorage.removeItem('token'); router.push('/login'); };

  const handleExport = () => {
    if (!result?.data?.rows) return;
    const cols = result.data.columns;
    const csv = [cols.join(','), ...result.data.rows.map((r: any) => cols.map((c: string) => `"${r[c] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'results.csv'; a.click();
  };

  const S: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#0a0a0f', display: 'flex', flexDirection: 'column', fontFamily: "'Courier New', monospace", color: '#fff' },
    header: { background: '#111118', borderBottom: '1px solid #1e1e2e', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    logo: { color: '#00d4aa', fontWeight: 700, fontSize: '16px', letterSpacing: '2px' },
    body: { display: 'flex', flex: 1, overflow: 'hidden' },
    sidebar: { width: '280px', background: '#111118', borderRight: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    main: { flex: 1, overflow: 'auto', padding: '24px' },
    label: { color: '#00d4aa', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px', display: 'block' },
    card: { background: '#111118', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
    btn: { padding: '8px 16px', background: '#00d4aa', border: 'none', borderRadius: '6px', color: '#0a0a0f', fontFamily: "'Courier New', monospace", fontSize: '11px', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' },
    btnGhost: { padding: '8px 16px', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#666', fontFamily: "'Courier New', monospace", fontSize: '11px', cursor: 'pointer' },
    input: { width: '100%', padding: '12px 14px', boxSizing: 'border-box', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: '8px', color: '#fff', fontFamily: "'Courier New', monospace", fontSize: '14px', outline: 'none', resize: 'none' as const },
    tag: { display: 'inline-block', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: '4px', padding: '2px 8px', color: '#00d4aa', fontSize: '11px', marginRight: '6px', marginBottom: '4px' },
    error: { background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#ff6060', fontSize: '13px', marginBottom: '16px' },
  };

  const chartData = result?.data?.rows?.slice(0, 20) || [];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.logo}>NL→SQL</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: '#444', fontSize: '12px' }}>HyperMindZ Assignment</span>
          <button onClick={handleLogout} style={S.btnGhost}>LOGOUT</button>
        </div>
      </div>
      <div style={S.body}>
        <div style={S.sidebar}>
          <div style={{ padding: '20px', borderBottom: '1px solid #1e1e2e' }}>
            <span style={S.label}>DATASETS</span>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ ...S.btn, width: '100%', padding: '10px' }}>
              {uploading ? 'UPLOADING...' : '+ UPLOAD CSV'}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleUpload} style={{ display: 'none' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {files.length === 0 && <div style={{ color: '#333', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>No files yet. Upload a CSV to start.</div>}
            {files.map((f: any) => (
              <div key={f.file_id} onClick={() => handleSelectFile(f)} style={{ padding: '12px', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer', background: selectedFile?.file_id === f.file_id ? 'rgba(0,212,170,0.1)' : '#0a0a0f', border: `1px solid ${selectedFile?.file_id === f.file_id ? 'rgba(0,212,170,0.3)' : '#1e1e2e'}` }}>
                <div style={{ color: '#fff', fontSize: '13px', marginBottom: '4px', wordBreak: 'break-all' }}>{f.filename}</div>
                <div style={{ color: '#444', fontSize: '11px' }}>{f.rows?.toLocaleString()} rows</div>
                <button onClick={e => { e.stopPropagation(); handleDelete(f.file_id); }} style={{ marginTop: '6px', background: 'none', border: 'none', color: '#444', fontSize: '11px', cursor: 'pointer', padding: 0 }}>delete</button>
              </div>
            ))}
          </div>
          {history.length > 0 && (
            <div style={{ borderTop: '1px solid #1e1e2e', padding: '12px' }}>
              <span style={{ ...S.label, marginBottom: '10px' }}>RECENT QUERIES</span>
              {history.map((h, i) => (
                <div key={i} onClick={() => setQuestion(h.question)} style={{ padding: '8px', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer', background: '#0a0a0f', border: '1px solid #1e1e2e' }}>
                  <div style={{ color: '#aaa', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.question}</div>
                  <div style={{ color: '#444', fontSize: '10px' }}>{h.rows} rows returned</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={S.main}>
          {error && <div style={S.error}>{error}</div>}
          {!selectedFile ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '40px' }}>📊</div>
              <div style={{ color: '#444', fontSize: '14px' }}>Select a dataset from the sidebar to start querying</div>
              <div style={{ color: '#333', fontSize: '12px' }}>Or upload a CSV file to get started</div>
            </div>
          ) : (
            <>
              <div style={S.card}>
                <span style={S.label}>ACTIVE DATASET</span>
                <div style={{ color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>{selectedFile.filename}</div>
                <div style={{ color: '#666', fontSize: '12px', marginBottom: '10px' }}>{selectedFile.rows?.toLocaleString()} rows</div>
                <div>{selectedFile.columns?.map((col: string) => <span key={col} style={S.tag}>{col}</span>)}</div>
              </div>
              <div style={S.card}>
                <span style={S.label}>ASK A QUESTION</span>
                <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. What is the total revenue by category?" rows={3} style={S.input}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery(); } }}
                  onFocus={e => (e.target.style.borderColor = '#00d4aa')}
                  onBlur={e => (e.target.style.borderColor = '#1e1e2e')} />
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Total revenue by category', 'Top 10 products by sales', 'Show orders over 500', 'Average order value by region'].map(q => (
                    <button key={q} onClick={() => setQuestion(q)} style={{ ...S.btnGhost, fontSize: '11px', padding: '4px 10px' }}>{q}</button>
                  ))}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button onClick={handleQuery} disabled={loading || !question.trim()} style={{ ...S.btn, padding: '12px 32px', opacity: loading || !question.trim() ? 0.5 : 1 }}>
                    {loading ? 'RUNNING QUERY...' : 'RUN QUERY →'}
                  </button>
                </div>
              </div>
              {result && (
                <>
                  <div style={S.card}>
                    <span style={S.label}>GENERATED SQL</span>
                    <pre style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '14px', color: '#00d4aa', fontSize: '13px', overflowX: 'auto', margin: 0 }}>{result.sql}</pre>
                    <div style={{ marginTop: '8px', color: '#444', fontSize: '11px' }}>Source: {selectedFile.filename} · {result.row_count} rows returned</div>
                  </div>
                  <div style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={S.label}>RESULTS</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {(['table', 'bar', 'line', 'pie'] as const).map(t => (
                          <button key={t} onClick={() => setChartType(t)} style={{ ...S.btnGhost, ...(chartType === t ? { background: '#00d4aa', color: '#0a0a0f', borderColor: '#00d4aa' } : {}), padding: '4px 10px' }}>{t.toUpperCase()}</button>
                        ))}
                        <button onClick={handleExport} style={{ ...S.btnGhost, padding: '4px 10px' }}>↓ CSV</button>
                      </div>
                    </div>
                    {chartType === 'table' && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead><tr>{result.data.columns.map((col: string) => <th key={col} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #1e1e2e', color: '#00d4aa', fontSize: '11px', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{col.toUpperCase()}</th>)}</tr></thead>
                          <tbody>{result.data.rows.map((row: any, i: number) => <tr key={i} style={{ borderBottom: '1px solid #0f0f1a' }}>{result.data.columns.map((col: string) => <td key={col} style={{ padding: '8px 12px', color: '#ccc', whiteSpace: 'nowrap' }}>{row[col] ?? '—'}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                    )}
                    {chartType === 'bar' && chartData.length > 0 && (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                          <XAxis dataKey={result.data.columns[0]} tick={{ fill: '#666', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#666', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: '8px' }} />
                          <Legend />
                          {result.data.columns.slice(1).map((col: string, i: number) => <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                    {chartType === 'line' && chartData.length > 0 && (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                          <XAxis dataKey={result.data.columns[0]} tick={{ fill: '#666', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#666', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: '8px' }} />
                          <Legend />
                          {result.data.columns.slice(1).map((col: string, i: number) => <Line key={col} type="monotone" dataKey={col} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />)}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                    {chartType === 'pie' && chartData.length > 0 && (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={chartData} dataKey={result.data.columns[1] || result.data.columns[0]} nameKey={result.data.columns[0]} cx="50%" cy="50%" outerRadius={100} label>
                            {chartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: '8px' }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}