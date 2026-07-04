"use client";

import { useState, useEffect } from 'react';
import { Sparkles, Save, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function Home() {
  const [activeTab, setActiveTab] = useState('api');
  
  const [apiConfig, setApiConfig] = useState({
    openRouterKey: '',
    serperKey: '',
    aiModel: 'anthropic/claude-3.5-sonnet'
  });
  
  const [discordConfig, setDiscordConfig] = useState({
    botToken: '',
    channelId: '',
    fullName: '',
    email: ''
  });

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle');
  const [report, setReport] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Load from LocalStorage
  useEffect(() => {
    const savedApi = localStorage.getItem('apiConfig');
    if (savedApi) setApiConfig(JSON.parse(savedApi));
    const savedDiscord = localStorage.getItem('discordConfig');
    if (savedDiscord) setDiscordConfig(JSON.parse(savedDiscord));
  }, []);

  const saveApiConfig = () => {
    localStorage.setItem('apiConfig', JSON.stringify(apiConfig));
    alert('API Configuration Saved!');
  };

  const saveDiscordConfig = () => {
    localStorage.setItem('discordConfig', JSON.stringify(discordConfig));
    alert('Discord Configuration Saved!');
  };

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!apiConfig.openRouterKey) {
      alert("Please configure an AI API key (Groq/OpenRouter) in the sidebar first.");
      return;
    }

    setStatus('searching');
    setReport(null);
    setErrorMsg('');

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          ...apiConfig
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to research company');
      }

      const data = await res.json();
      setReport(data);
      setStatus('done');
      
      // Auto-post to discord if configured
      if (discordConfig.botToken && discordConfig.channelId) {
         postToDiscord(data);
      }
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
      setStatus('error');
    }
  };
  
  const postToDiscord = async (reportData: any) => {
      // Create a temporary PDF blob to upload
      const doc = generatePDFBlob(reportData);
      const pdfBlob = doc.output('blob');
      
      const formData = new FormData();
      formData.append('pdf', pdfBlob, 'Company_Report.pdf');
      formData.append('discordConfig', JSON.stringify(discordConfig));
      formData.append('reportSummary', JSON.stringify({
          companyName: reportData.CompanyName,
          website: reportData.Website
      }));
      
      try {
          await fetch('/api/discord', {
              method: 'POST',
              body: formData
          });
      } catch(e) {
          console.error("Discord webhook failed", e);
      }
  };
  
  const generatePDFBlob = (data: any) => {
    const doc = new jsPDF();
    const margin = 20;
    
    // Header
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 209, 102); // accent color
    doc.setFontSize(10);
    doc.text(`${data.CompanyName?.toUpperCase() || 'UNKNOWN'} · COMPANY RESEARCH REPORT`, margin, 15);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text(data.CompanyName || 'Unknown Company', margin, 28);
    
    // Reset colors for body
    doc.setTextColor(0, 0, 0);
    let currentY = 55;
    
    // Helper function for titles
    const addTitle = (title: string) => {
       doc.setFontSize(12);
       doc.setTextColor(200, 150, 0); // Darker accent for white bg
       doc.text(title.toUpperCase(), margin, currentY);
       doc.setTextColor(0, 0, 0);
       currentY += 10;
    };
    
    // Company Info
    addTitle('Company Information');
    doc.setFontSize(10);
    doc.text(`Website: ${data.Website || 'N/A'}`, margin, currentY); currentY += 7;
    doc.text(`Phone: ${data.Phone || 'N/A'}`, margin, currentY); currentY += 7;
    doc.text(`Address: ${data.Address || 'N/A'}`, margin, currentY); currentY += 15;
    
    // Products
    addTitle('Products & Services');
    const productsText = Array.isArray(data.Products) ? data.Products.join('\\n') : (data.Products || 'N/A');
    const splitProducts = doc.splitTextToSize(productsText, 170);
    doc.text(splitProducts, margin, currentY);
    currentY += (splitProducts.length * 5) + 10;
    
    // Pain Points
    addTitle('AI-Generated Pain Points');
    const painPointsText = Array.isArray(data.PainPoints) ? data.PainPoints.join('\\n') : (data.PainPoints || 'N/A');
    const splitPainPoints = doc.splitTextToSize(painPointsText, 170);
    doc.text(splitPainPoints, margin, currentY);
    currentY += (splitPainPoints.length * 5) + 10;
    
    // Competitors
    addTitle('Competitors');
    if (data.Competitors && Array.isArray(data.Competitors)) {
       data.Competitors.forEach((comp: any) => {
           doc.text(`${comp.Name} - ${comp.Website}`, margin, currentY);
           currentY += 7;
       });
    }
    
    return doc;
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    const doc = generatePDFBlob(report);
    doc.save(`${report.CompanyName?.replace(/\\s+/g, '_')}_Research.pdf`);
  };

  const renderList = (data: any, type: 'list' | 'pill' = 'list') => {
      if (!data) return 'N/A';
      
      const formatItem = (text: string, index: number) => {
          const cleanText = text.replace(/^[-*•]\\s*/, '');
          if (type === 'pill') {
              return <div key={index} className="product-pill">{cleanText}</div>;
          }
          return <li key={index} className="list-item">{cleanText}</li>;
      };

      if (Array.isArray(data)) {
          return data.map((item: any, i: number) => formatItem(String(item), i));
      }
      if (typeof data === 'string') {
          return data.split('\\n').map((item: string, i: number) => formatItem(item, i));
      }
      return String(data);
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon"><Sparkles size={18} /></div>
          <div>
            <div className="brand-title">Research AI</div>
            <div className="brand-subtitle">Company Intelligence</div>
          </div>
        </div>

        <button className="new-research-btn" onClick={() => { setReport(null); setStatus('idle'); setQuery(''); }}>
          <span>+ New Research</span>
        </button>

        <div className="tabs">
          <div className={`tab ${activeTab === 'api' ? 'active' : ''}`} onClick={() => setActiveTab('api')}>API</div>
          <div className={`tab ${activeTab === 'discord' ? 'active' : ''}`} onClick={() => setActiveTab('discord')}>DISCORD</div>
        </div>

        {activeTab === 'api' && (
          <div className="tab-content">
            <div className="form-group">
              <label>API Key (OpenRouter / Groq)</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="sk-or-v1-... or gsk_..."
                value={apiConfig.openRouterKey}
                onChange={e => setApiConfig({...apiConfig, openRouterKey: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Search Key (Serper / Zenserp)</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Your Search API key..."
                value={apiConfig.serperKey}
                onChange={e => setApiConfig({...apiConfig, serperKey: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>AI Model</label>
              <select 
                className="select-field"
                value={apiConfig.aiModel}
                onChange={e => setApiConfig({...apiConfig, aiModel: e.target.value})}
              >
                <option value="llama-3.1-8b-instant">Llama 3.1 8B (Groq)</option>
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
                <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (OpenRouter)</option>
                <option value="openai/gpt-4o">GPT-4o (OpenRouter)</option>
              </select>
            </div>
            <button className="btn-primary" onClick={saveApiConfig}>Save Configuration</button>
            
            <div className="how-it-works">
              <h4>How it works</h4>
              <ul className="step-list">
                <li className="step-item"><div className="step-number">1</div> Enter a company name or URL</li>
                <li className="step-item"><div className="step-number">2</div> Serper.dev searches and crawls it</li>
                <li className="step-item"><div className="step-number">3</div> OpenRouter AI generates insights</li>
                <li className="step-item"><div className="step-number">4</div> Download a professional PDF report</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'discord' && (
          <div className="tab-content">
            <div className="info-box">
              <h4>Discord Bot Integration</h4>
              <p>After research completes, the report auto-sends to your configured channel.</p>
            </div>
            <div className="form-group">
              <label>Bot Token</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Bot token..."
                value={discordConfig.botToken}
                onChange={e => setDiscordConfig({...discordConfig, botToken: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Channel ID</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="000000000000000000"
                value={discordConfig.channelId}
                onChange={e => setDiscordConfig({...discordConfig, channelId: e.target.value})}
              />
            </div>
            <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '1.5rem', marginBottom: '1rem'}}>Applicant Details</h4>
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Your full name"
                value={discordConfig.fullName}
                onChange={e => setDiscordConfig({...discordConfig, fullName: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="email@example.com"
                value={discordConfig.email}
                onChange={e => setDiscordConfig({...discordConfig, email: e.target.value})}
              />
            </div>
            <button className="btn-discord" onClick={saveDiscordConfig}>Save Discord Config</button>
          </div>
        )}
      </aside>

      {/* Main Window */}
      <main className="main-content">
        <div className="top-bar">
          <div className="page-title">Company Research</div>
          <div className="status-badge">LIVE</div>
        </div>

        {status === 'idle' && (
          <div className="hero-section">
            <div className="hero-tag">AI-Powered Intelligence</div>
            <h1 className="hero-title">Know any company<br/>in minutes.</h1>
            <p className="hero-subtitle">Enter a company name or website URL to get AI-powered insights, competitor analysis, pain points, and a professional PDF report.</p>
            
            <div className="suggested-pills">
               <div className="pill" onClick={() => setQuery('stripe.com')}>stripe.com</div>
               <div className="pill" onClick={() => setQuery('Tesla')}>Tesla</div>
               <div className="pill" onClick={() => setQuery('Microsoft')}>Microsoft</div>
               <div className="pill" onClick={() => setQuery('OpenAI')}>OpenAI</div>
            </div>
            
            <div className="api-notice">Configure API keys in the sidebar to get started</div>
          </div>
        )}
        
        {['searching', 'crawling', 'generating'].includes(status) && (
            <div className="hero-section" style={{ flex: 1 }}>
               <div className="progress-container">
                   <div className="spinner"></div>
                   <div className="progress-text">Research in progress...</div>
                   <div className="progress-subtext">This takes about 15-30 seconds to crawl and analyze.</div>
               </div>
            </div>
        )}

        {status === 'error' && (
             <div className="hero-section" style={{ flex: 1 }}>
                <div style={{ color: '#ff6b6b' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Research Failed</h3>
                    <p>{errorMsg}</p>
                </div>
             </div>
        )}

        {status === 'done' && report && (
           <div className="results-container">
               <div className="report-card">
                  <div className="report-header">
                      <div>
                          <div className="report-company-name">{report.CompanyName || 'Unknown'}</div>
                          <a href={report.Website} target="_blank" rel="noreferrer" className="report-company-url">{report.Website || 'N/A'}</a>
                      </div>
                      <div className="badge-success">RESEARCH COMPLETE</div>
                  </div>
                  
                  <div className="data-grid">
                      <div className="data-box">
                         <div className="data-label">PHONE</div>
                         <div className="data-value">{report.Phone || 'Not publicly listed'}</div>
                      </div>
                      <div className="data-box">
                         <div className="data-label">ADDRESS</div>
                         <div className="data-value">{report.Address || 'Not publicly listed'}</div>
                      </div>
                  </div>
                  
                  <div className="section-title">PRODUCTS & SERVICES</div>
                  <div className="pill-list">
                      {renderList(report.Products, 'pill')}
                  </div>
                  
                  <div className="section-title">AI-GENERATED PAIN POINTS</div>
                  <ul className="pain-points-list">
                      {renderList(report.PainPoints, 'list')}
                  </ul>
                  
                  <div className="section-title">COMPETITORS</div>
                  <div className="competitors-grid">
                      {report.Competitors?.map((comp: any, idx: number) => (
                         <div key={idx} className="competitor-box">
                             <div className="competitor-name">{comp.Name}</div>
                             <a href={comp.Website} target="_blank" className="competitor-link" rel="noreferrer">{comp.Website}</a>
                         </div>
                      ))}
                  </div>

                  <div className="report-actions">
                      <button className="btn-solid-accent" onClick={handleDownloadPDF}>
                          <Download size={18} /> Download PDF Report
                      </button>
                      {discordConfig.botToken && discordConfig.channelId && (
                          <div className="btn-success">
                             ✓ Sent to Discord
                          </div>
                      )}
                  </div>
               </div>
           </div>
        )}

        <div className="search-container">
          <form className="search-box" onSubmit={handleResearch}>
            <input 
              type="text" 
              className="search-input-main"
              placeholder="Enter a company name (e.g. Relu Consultancy) or website URL..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              disabled={['searching', 'crawling', 'generating'].includes(status)}
            />
            <button 
              type="submit" 
              className="search-btn"
              disabled={!query.trim() || ['searching', 'crawling', 'generating'].includes(status)}
            >
              Research &rarr;
            </button>
          </form>
          <div className="search-hint">Enter to research &bull; Shift+Enter for new line</div>
        </div>
      </main>
    </div>
  );
}
