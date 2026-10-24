import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyOtp, signup, isHighContrast, toggleDisplayMode } = useAuth();

  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Registration state
  const [regName, setRegName] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [registeredUser, setRegisteredUser] = useState(null);

  // 2FA OTP Modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [sessionToken, setSessionToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('•••• 4321');
  const [otpError, setOtpError] = useState('');

  // Quick preset helper
  const handleQuickFill = (id, pass) => {
    setIdentifier(id);
    setPassword(pass);
    setErrorMsg('');
  };

  // Sample data helper for register
  const handleAutoFillRegister = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setRegName(`Test Client ${rand}`);
    setRegUser(`client_${rand}`);
    setRegEmail(`client_${rand}@bankbuddy.in`);
    setRegPass('BankBuddy@2026');
    setErrorMsg('');
  };

  // Step 1: Submit Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const data = await login(identifier, password);
      if (data.step === 'OTP_REQUIRED') {
        setSessionToken(data.sessionToken);
        setMaskedPhone(data.user?.maskedPhone || '•••• 4321');
        setOtpDigits(['', '', '', '', '', '']);
        setOtpError('');
        setShowOtpModal(true);
      } else if (data.accessToken) {
        navigate('/desktop');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm OTP
  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    // Auto-advance
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const fillDemoOtp = () => {
    setOtpDigits(['1', '2', '3', '4', '5', '6']);
  };

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setOtpError('Please enter all 6 digits of the OTP.');
      return;
    }

    setLoading(true);
    setOtpError('');

    try {
      await verifyOtp(sessionToken, otp);
      setShowOtpModal(false);
      navigate('/desktop');
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Register Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await signup({
        name: regName,
        username: regUser,
        email: regEmail,
        password: regPass
      });

      setRegisteredUser({
        ...data.user,
        accessToken: data.accessToken,
        password: regPass
      });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Direct enter dashboard after registration
  const handleDirectDashboard = () => {
    if (registeredUser && registeredUser.accessToken) {
      const sessionData = {
        token: registeredUser.accessToken,
        accessToken: registeredUser.accessToken,
        id: registeredUser.id,
        name: registeredUser.name,
        username: registeredUser.username,
        email: registeredUser.email,
        crn: registeredUser.crn,
        cardNumber: registeredUser.cardNumber,
        role: registeredUser.role
      };
      localStorage.setItem('bankBuddyUser', JSON.stringify(sessionData));
      window.location.href = '/desktop';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors font-sans">
      {/* Top Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 sm:px-12 py-3 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
              Bank<span className="text-sky-600 dark:text-sky-400">Buddy</span>
            </span>
            <span className="text-[10px] font-bold tracking-wider text-slate-600 dark:text-slate-400 uppercase">
              Autonomous Wealth &bull; Verified Banking
            </span>
          </div>
        </div>

        {/* Accessibility / Display Mode */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-slate-700 dark:text-slate-300">Display Mode</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isHighContrast}
              onChange={(e) => toggleDisplayMode(e.target.checked)}
            />
            <div className="w-8 h-4 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </header>

      {/* Quick Presets Strip */}
      <div className="bg-blue-50 dark:bg-slate-900/80 border-b border-blue-100 dark:border-slate-800 px-6 sm:px-12 py-2 text-xs flex items-center justify-between flex-wrap gap-2">
        <span className="text-slate-700 dark:text-slate-300 font-medium">
          <strong>⚡ Quick Login Presets:</strong> Click any chip to auto-populate login credentials:
        </span>
        <div className="flex items-center gap-2 flex-wrap font-mono">
          <button
            type="button"
            onClick={() => handleQuickFill('98234105', 'BankBuddy@2026')}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-700 rounded text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition font-semibold text-[11px]"
          >
            🔑 CRN: 98234105 (Elena)
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('Shrey819', 'BankBuddy@2026')}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-700 rounded text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition font-semibold text-[11px]"
          >
            👤 User: Shrey819
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('aarav_patel', 'BankBuddy@2026')}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-700 rounded text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition font-semibold text-[11px]"
          >
            👤 User: aarav_patel
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Left Side: Illustration / Brand Banner */}
        <div className="flex flex-col items-center text-center">
          <div className="relative w-full max-w-sm mb-6 p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col items-center">
            <div className="absolute top-4 left-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" /> ISO-20022 Verified
            </div>
            <div className="w-28 h-28 my-6 rounded-full bg-gradient-to-tr from-indigo-100 to-sky-100 dark:from-indigo-950 dark:to-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-16 h-16 stroke-[1.5]" />
            </div>
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white mb-2">Autonomous Wealth</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
              Direct API integration with PostgreSQL ledger, multi-factor step-up verification, and ISO 20022 security compliance.
            </p>
          </div>
        </div>

        {/* Right Side: Auth Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none p-6 sm:p-8">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMsg('');
              }}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${
                activeTab === 'login'
                  ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMsg('');
              }}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${
                activeTab === 'register'
                  ? 'border-red-600 text-red-600 dark:border-red-500 dark:text-red-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Register with Bank Buddy
            </button>
          </div>

          {/* Alert Message */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  CRN / Username / Email / Card Number
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. 98234105, elena, or elena.rostova@wealth.client"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Net Banking Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                />
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed pt-1">
                By clicking on 'Secure login', you accept that you have read our Terms & conditions, Privacy Policy, and Tips for Safe Banking.
              </div>

              <button
                type="submit"
                disabled={loading || !identifier || !password}
                className={`w-full py-3 rounded-lg text-sm font-bold transition shadow-sm ${
                  identifier && password
                    ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                    : 'bg-red-200 dark:bg-red-950/60 text-white/80 cursor-not-allowed'
                }`}
              >
                {loading ? 'Verifying with Banking Gateway...' : 'Secure login'}
              </button>
            </form>
          )}

          {/* 2. REGISTRATION FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Sanjna Verma"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Desired Username</label>
                <input
                  type="text"
                  required
                  value={regUser}
                  onChange={(e) => setRegUser(e.target.value)}
                  placeholder="e.g. sanjna_wealth"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. sanjna@bankbuddy.in"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password (Min 8 chars, letters & numbers)
                </label>
                <input
                  type="password"
                  required
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  placeholder="BankBuddy@2026"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleAutoFillRegister}
                  className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition"
                >
                  ⚡ Auto-fill Sample Register Data
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition shadow-sm mt-1 cursor-pointer"
              >
                {loading ? 'Saving User to Database...' : 'Register Net Banking Account'}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Registration Success Confirmation Modal */}
      {registeredUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl flex flex-col items-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mb-1">
              User Successfully Saved in Database!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Your Net Banking user profile and ledger record have been created in PostgreSQL.
            </p>

            <div className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left text-xs mb-5 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-bold text-slate-900 dark:text-white">{registeredUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Username:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{registeredUser.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Generated CRN:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">{registeredUser.crn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Card Number:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">•••• {registeredUser.cardNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{registeredUser.email}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDirectDashboard}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm mb-2 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Enter Dashboard Directly <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                const crn = registeredUser.crn;
                const pass = registeredUser.password;
                setRegisteredUser(null);
                setActiveTab('login');
                handleQuickFill(crn, pass);
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
            >
              Or return to Login tab
            </button>
          </div>
        </div>
      )}

      {/* 2-Factor OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl flex flex-col items-center">
            <div className="text-3xl mb-2">📲</div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Two-Factor Authentication</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Enter the 6-digit Security OTP sent to your registered mobile ending in <strong>{maskedPhone}</strong>.
            </p>

            {otpError && (
              <div className="w-full mb-3 p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400 font-semibold">
                {otpError}
              </div>
            )}

            <div className="flex justify-center gap-2 mb-4">
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-input-${index}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-10 h-12 text-center text-lg font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              ))}
            </div>

            <button
              type="button"
              onClick={fillDemoOtp}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-4"
            >
              ⚡ Fill Demo OTP: 123456
            </button>

            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition shadow-sm mb-2 cursor-pointer"
            >
              {loading ? 'Authenticating Token...' : 'Verify & Enter Autonomous Wealth'}
            </button>

            <button
              type="button"
              onClick={() => setShowOtpModal(false)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              &larr; Back to Net Banking login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
