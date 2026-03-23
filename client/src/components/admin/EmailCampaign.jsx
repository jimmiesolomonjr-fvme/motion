import { useState, useMemo } from 'react';
import api from '../../services/api';
import { Mail, Send, CheckCircle, AlertCircle, Eye, Zap, FlaskConical, Users } from 'lucide-react';

const WELCOME_BACK_TEMPLATE = {
  subject: "We fixed signup — come finish your profile!",
  body: `<h2 style="margin:0 0 16px;color:#D4AF37;font-size:20px;">Hey 👋</h2>
<p style="margin:0 0 16px;">We had a small hiccup during signup that may have interrupted your profile setup. <strong>That's been fixed now</strong> — everything is smooth.</p>
<p style="margin:0 0 24px;">Tap below to jump back in and finish setting up your profile. It only takes a minute.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
  <tr>
    <td align="center" style="background-color:#D4AF37;border-radius:10px;">
      <a href="https://motion.up.railway.app" target="_blank" style="display:inline-block;padding:14px 36px;color:#0A0A0A;font-size:15px;font-weight:700;text-decoration:none;">Complete Your Profile</a>
    </td>
  </tr>
</table>
<p style="margin:0;color:#999;font-size:13px;">See you on Motion ✨</p>`,
};

export default function EmailCampaign() {
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewCount, setPreviewCount] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const roleLabel = targetRole === 'STEPPER' ? 'Steppers' : targetRole === 'BADDIE' ? 'Baddies' : 'Everyone';
  const filterLabel = targetFilter === 'incomplete_profile' ? ' (Incomplete Profiles)' : '';

  const resetConfirm = () => { setConfirming(false); setResult(null); };

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewCount(null);
    try {
      const payload = {};
      if (targetRole) payload.targetRole = targetRole;
      if (targetFilter) payload.targetFilter = targetFilter;
      const { data } = await api.post('/admin/email/preview', payload);
      setPreviewCount(data.count);
      setShowPreview(true);
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.error || 'Preview failed' });
    } finally {
      setPreviewing(false);
    }
  };

  const handleTestSend = async () => {
    setTestSending(true);
    setResult(null);
    try {
      const { data } = await api.post('/admin/email/test', { subject, bodyHtml });
      setResult({ success: true, message: `Test email sent to ${data.email}` });
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.error || 'Failed to send test email' });
    } finally {
      setTestSending(false);
    }
  };

  const handleSend = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    setConfirming(false);
    setResult(null);
    try {
      let data;
      if (newestMembersData) {
        // Role-aware send: Steppers see Baddies, Baddies see Steppers
        const res = await api.post('/admin/email/send-newest-members', {
          subject: newestMembersData.subject,
          baddieBodyHtml: newestMembersData.baddieBodyHtml,
          stepperBodyHtml: newestMembersData.stepperBodyHtml,
        });
        data = res.data;
      } else {
        const payload = { subject, bodyHtml };
        if (targetRole) payload.targetRole = targetRole;
        if (targetFilter) payload.targetFilter = targetFilter;
        const res = await api.post('/admin/email/send', payload);
        data = res.data;
      }
      setResult({
        success: data.sent > 0,
        message: `Sent ${data.sent} email${data.sent !== 1 ? 's' : ''}${data.failed ? `, ${data.failed} failed` : ''}`,
      });
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.error || 'Failed to send emails' });
    } finally {
      setLoading(false);
    }
  };

  const [loadingTemplate, setLoadingTemplate] = useState(false);
  // When set, the send button uses the dedicated role-aware endpoint
  const [newestMembersData, setNewestMembersData] = useState(null);

  const applyTemplate = (template) => {
    setSubject(template.subject);
    setBodyHtml(template.body);
    setNewestMembersData(null);
    resetConfirm();
    setShowPreview(false);
  };

  const buildMembersGridHtml = (cards) => {
    const gridHtml = cards.map((c) => {
      const photo = c.photoUrl
        ? `<img src="${c.photoUrl}" alt="${c.name}" width="100" height="100" style="width:100px;height:100px;border-radius:12px;object-fit:cover;display:block;margin:0 auto 8px;" />`
        : `<div style="width:100px;height:100px;border-radius:12px;background:#333;margin:0 auto 8px;"></div>`;
      return `<td align="center" valign="top" style="padding:8px;width:33%;">
        ${photo}
        <p style="margin:0;color:#fff;font-size:14px;font-weight:600;">${c.name}</p>
        ${c.city ? `<p style="margin:2px 0 0;color:#999;font-size:12px;">${c.city}</p>` : ''}
      </td>`;
    });
    const rows = [];
    for (let i = 0; i < gridHtml.length; i += 3) {
      rows.push(`<tr>${gridHtml.slice(i, i + 3).join('')}</tr>`);
    }
    return `<h2 style="margin:0 0 8px;color:#D4AF37;font-size:20px;">New faces just joined! 👀</h2>
<p style="margin:0 0 20px;color:#ccc;">Check out the newest members in your area — don't miss out.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
  ${rows.join('')}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
  <tr>
    <td align="center" style="background-color:#D4AF37;border-radius:10px;">
      <a href="https://motion.up.railway.app/feed" target="_blank" style="display:inline-block;padding:14px 36px;color:#0A0A0A;font-size:15px;font-weight:700;text-decoration:none;">See Who's New</a>
    </td>
  </tr>
</table>
<p style="margin:0;color:#999;font-size:13px;">Your next match could be one tap away ✨</p>`;
  };

  const loadNewestMembersTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const { data } = await api.get('/admin/email/newest-members');
      const baddieBodyHtml = buildMembersGridHtml(data.baddieCards || []);
      const stepperBodyHtml = buildMembersGridHtml(data.stepperCards || []);
      const subj = "New members just joined Motion — come see who's here!";

      setSubject(subj);
      // Show the Baddie version in the editor (what Steppers will see)
      setBodyHtml(baddieBodyHtml);
      setNewestMembersData({ baddieBodyHtml, stepperBodyHtml, subject: subj });
      resetConfirm();
      setShowPreview(false);
    } catch (err) {
      setResult({ success: false, message: 'Failed to load newest members' });
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Build branded HTML for iframe preview
  const previewHtml = useMemo(() => {
    if (!bodyHtml.trim()) return '';
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#1A1A1A;border-radius:16px;overflow:hidden;">
<tr><td align="center" style="padding:32px 24px 16px;"><h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:4px;color:#D4AF37;">MOTION</h1></td></tr>
<tr><td style="padding:0 24px;"><div style="height:1px;background:linear-gradient(to right,transparent,#D4AF37,transparent);"></div></td></tr>
<tr><td style="padding:24px;color:#E5E5E5;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
<tr><td style="padding:0 24px;"><div style="height:1px;background:linear-gradient(to right,transparent,#333,transparent);"></div></td></tr>
<tr><td align="center" style="padding:20px 24px 28px;color:#666;font-size:12px;">&copy; ${new Date().getFullYear()} Motion &mdash; Move Different</td></tr>
</table></td></tr></table></body></html>`;
  }, [bodyHtml]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Mail size={18} className="text-gold" />
        <h2 className="text-lg font-bold text-white">Email Campaign</h2>
      </div>

      <div className="bg-dark-100 rounded-xl p-4 space-y-4">
        {/* Quick Templates */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Quick Templates</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyTemplate(WELCOME_BACK_TEMPLATE)}
              className="flex items-center gap-2 px-3 py-2 bg-dark-50 text-gold text-sm rounded-lg hover:bg-dark-50/70 transition-colors border border-dark-50 hover:border-gold/30"
            >
              <Zap size={14} />
              Welcome Back (Signup Fix)
            </button>
            <button
              onClick={loadNewestMembersTemplate}
              disabled={loadingTemplate}
              className="flex items-center gap-2 px-3 py-2 bg-dark-50 text-gold text-sm rounded-lg hover:bg-dark-50/70 transition-colors border border-dark-50 hover:border-gold/30 disabled:opacity-50"
            >
              {loadingTemplate ? (
                <div className="w-3.5 h-3.5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              ) : (
                <Users size={14} />
              )}
              Newest Members
            </button>
          </div>
        </div>

        {/* Target Audience */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Target Audience</label>
            <select
              value={targetRole}
              onChange={(e) => { setTargetRole(e.target.value); resetConfirm(); setPreviewCount(null); }}
              className="w-full bg-dark-50 text-white rounded-lg px-3 py-2 text-sm border border-dark-50 focus:border-gold focus:outline-none"
            >
              <option value="">Everyone</option>
              <option value="STEPPER">Steppers Only</option>
              <option value="BADDIE">Baddies Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Filter</label>
            <select
              value={targetFilter}
              onChange={(e) => { setTargetFilter(e.target.value); resetConfirm(); setPreviewCount(null); }}
              className="w-full bg-dark-50 text-white rounded-lg px-3 py-2 text-sm border border-dark-50 focus:border-gold focus:outline-none"
            >
              <option value="">All Users</option>
              <option value="incomplete_profile">Incomplete Profiles</option>
            </select>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Subject Line</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); resetConfirm(); }}
            placeholder="Email subject..."
            className="w-full bg-dark-50 text-white rounded-lg px-3 py-2 text-sm border border-dark-50 focus:border-gold focus:outline-none"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Body <span className="text-gray-500 font-normal">(HTML supported)</span>
          </label>
          <textarea
            value={bodyHtml}
            onChange={(e) => { setBodyHtml(e.target.value); setNewestMembersData(null); resetConfirm(); setShowPreview(false); }}
            placeholder="<p>Your email content here...</p>"
            rows={8}
            className="w-full bg-dark-50 text-white rounded-lg px-3 py-2 text-sm border border-dark-50 focus:border-gold focus:outline-none resize-none font-mono"
          />
        </div>

        {/* Preview + Test Send Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handlePreview}
            disabled={previewing || !bodyHtml.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-dark-50 text-white text-sm rounded-lg hover:bg-dark-50/70 transition-colors border border-dark-50 hover:border-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {previewing ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Eye size={14} />
            )}
            Preview
          </button>
          <button
            onClick={handleTestSend}
            disabled={testSending || !subject.trim() || !bodyHtml.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-dark-50 text-gold text-sm rounded-lg hover:bg-dark-50/70 transition-colors border border-dark-50 hover:border-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testSending ? (
              <div className="w-3.5 h-3.5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            ) : (
              <FlaskConical size={14} />
            )}
            Send Test to Me
          </button>
          {previewCount !== null && (
            <span className="text-sm text-gray-400">
              <strong className="text-white">{previewCount}</strong> recipient{previewCount !== 1 ? 's' : ''} match
            </span>
          )}
        </div>

        {/* Email Preview iframe */}
        {showPreview && previewHtml && (
          <div className="rounded-lg overflow-hidden border border-dark-50">
            <div className="bg-dark-50 px-3 py-1.5 text-xs text-gray-400 flex items-center gap-1.5">
              <Eye size={12} /> Email Preview
            </div>
            <iframe
              srcDoc={previewHtml}
              title="Email preview"
              className="w-full bg-[#0A0A0A] border-0"
              style={{ height: 400 }}
              sandbox=""
            />
          </div>
        )}

        {/* Role-aware info banner */}
        {newestMembersData && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-400 text-sm">
              <strong>Role-aware send:</strong> Steppers will see newest Baddies, Baddies will see newest Steppers. Preview shows the Baddie version (what Steppers receive).
            </p>
          </div>
        )}

        {/* Confirmation Warning */}
        {confirming && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-400 text-sm">
              {newestMembersData
                ? <>Send <strong>&ldquo;{subject}&rdquo;</strong> to <strong>all Steppers &amp; Baddies</strong> (role-aware)? This cannot be undone.</>
                : <>Send <strong>&ldquo;{subject}&rdquo;</strong> to <strong>{previewCount ?? '?'} {roleLabel}{filterLabel}</strong>? This cannot be undone.</>
              }
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`flex items-center gap-2 rounded-lg p-3 ${
            result.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
          }`}>
            {result.success ? <CheckCircle size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
            <p className={`text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>{result.message}</p>
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!subject.trim() || !bodyHtml.trim() || loading}
          className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            confirming
              ? 'bg-yellow-500 text-dark hover:bg-yellow-400'
              : 'bg-gold text-dark hover:bg-gold/90'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-dark border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send size={14} />
              {confirming ? `Confirm Send to ${roleLabel}` : 'Send Email Campaign'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
