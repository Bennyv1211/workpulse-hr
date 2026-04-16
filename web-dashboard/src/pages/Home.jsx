import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import {
  Clock,
  Users,
  BarChart3,
  Shield,
  Smartphone,
  CheckCircle,
  ArrowRight,
  Star,
  Play,
  Mail,
  Building2,
  Phone,
  User,
  Zap,
  Globe,
  Lock,
  Bell,
  FileText
} from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    employees: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await api.post('/contact', {
        business_name: formData.businessName,
        contact_name: formData.contactName,
        email: formData.email,
        phone: formData.phone,
        employees: formData.employees,
        message: formData.message,
      })
      setSubmitSuccess(true)
      setFormData({
        businessName: '',
        contactName: '',
        email: '',
        phone: '',
        employees: '',
        message: ''
      })
    } catch (error) {
      console.error('Error submitting form:', error)
      alert(error.response?.data?.detail || 'Unable to send your message right now. Please email support@emplora.org directly.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const features = [
    {
      icon: Clock,
      title: 'Time Tracking That Feeds Payroll',
      description: 'Clock-ins, breaks, attendance, lateness, and approved leave all flow into payroll review so HR is not stitching numbers together by hand.',
      color: 'bg-blue-500'
    },
    {
      icon: Users,
      title: 'Full Employee Lifecycle Control',
      description: 'Create employees, managers, and HR users, assign departments, set pay type, apply leave balances, and bulk import entire teams from Excel.',
      color: 'bg-purple-500'
    },
    {
      icon: BarChart3,
      title: 'Live Operational Visibility',
      description: 'See who is working, on break, late, off today, pending approval, or missing hours from dashboards built for HR and managers.',
      color: 'bg-orange-500'
    },
    {
      icon: FileText,
      title: 'Payroll and Paystubs in One Flow',
      description: 'Review payroll, save pay runs, generate polished PDF paystubs, and send them straight to the employee pay tab without leaving the platform.',
      color: 'bg-emerald-500'
    },
    {
      icon: Shield,
      title: 'Role-Locked Security',
      description: 'Employees stay in the employee experience, managers stay in the manager lane, and HR keeps control over payroll, account setup, and admin actions.',
      color: 'bg-red-500'
    },
    {
      icon: Smartphone,
      title: 'Mobile + Web Working Together',
      description: 'Employees use the mobile app while HR and managers run the business from the web dashboard, all backed by one shared system.',
      color: 'bg-teal-500'
    }
  ]

  const benefits = [
    'Replace spreadsheets with one connected HR operating system',
    'Run leave approvals, attendance, payroll, and paystubs from one dashboard',
    'Bulk import employees from Excel when onboarding a whole team',
    'Keep working from mobile even when internet drops',
    'Export backups when HR needs a safe offline copy',
    'Cut payroll prep time and approval delays dramatically'
  ]

  const testimonials = [
    {
      name: 'Sarah Mitchell',
      role: 'HR Director',
      company: 'TechFlow Inc.',
      image: 'SM',
      rating: 5,
      text: 'Emplora turned our people operations into a machine. Leave, payroll, attendance, and employee records finally speak the same language.'
    },
    {
      name: 'Michael Chen',
      role: 'Operations Manager',
      company: 'BuildRight Construction',
      image: 'MC',
      rating: 5,
      text: 'The manager dashboard gives me real-time team visibility without giving away HR controls. It is exactly the level of access we needed.'
    },
    {
      name: 'Jessica Rodriguez',
      role: 'CEO',
      company: 'GreenLeaf Restaurants',
      image: 'JR',
      rating: 5,
      text: 'From onboarding to paystub delivery, this platform makes us look organized, fast, and far bigger than we are. It is genuinely a brag-worthy system.'
    }
  ]

  const stats = [
    { value: '10,000+', label: 'Employees Managed' },
    { value: '500+', label: 'Businesses Supported' },
    { value: '99.9%', label: 'Platform Availability' },
    { value: '4.9/5', label: 'Customer Rating' }
  ]

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/emplora-wordmark.svg" alt="Emplora" className="h-8 w-auto" />
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#benefits" className="text-gray-600 hover:text-gray-900 transition-colors">Benefits</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors">Reviews</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors">Contact</a>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/login')} className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors">
                Sign In
              </button>
              <button onClick={() => navigate('/signup')} className="px-5 py-2.5 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25">
                Create HR Account
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 bg-gradient-to-br from-primary-50 via-white to-cyan-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-full mb-6">
                <Zap className="w-4 h-4 text-primary-600" />
                <span className="text-primary-700 text-sm font-medium">Built to run your workforce without the chaos</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                The HR system that actually
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-cyan-500"> runs payroll, leave, people, and approvals together</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Emplora is the all-in-one workforce platform for teams that want to look sharp, move fast, and stop babysitting spreadsheets. HR gets control, managers get visibility, employees get a smooth mobile experience, and the whole business gets cleaner data.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => navigate('/signup')} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-all shadow-xl shadow-primary-500/30 hover:-translate-y-0.5">
                  Create HR Account
                  <ArrowRight className="w-5 h-5" />
                </button>
                <a href="#contact" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all border border-gray-200">
                  <Play className="w-5 h-5 text-primary-500" />
                  Contact Us
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-6 transform rotate-2 hover:rotate-0 transition-transform duration-300">
                <img src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=500&fit=crop" alt="Dashboard Preview" className="rounded-xl w-full" />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-emerald-500 text-white p-4 rounded-xl shadow-lg z-20">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8" />
                  <div>
                    <p className="font-bold">Payroll Ready</p>
                    <p className="text-emerald-100 text-sm">Hours, leave, and pay aligned</p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-sky-500 text-white p-4 rounded-xl shadow-lg z-20">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8" />
                  <div>
                    <p className="font-bold">Role Locked</p>
                    <p className="text-sky-100 text-sm">HR and manager dashboards</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl font-bold text-white mb-2">{stat.value}</p>
                <p className="text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything serious HR teams need, without switching systems
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Emplora is built to handle the real workflow: clocking, approvals, employee setup, leave balances, payroll review, branded paystubs, exports, and backup protection.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="group p-8 bg-white rounded-2xl border border-gray-100 hover:border-primary-200 hover:shadow-xl transition-all duration-300">
                <div className={`w-14 h-14 ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="py-24 bg-gradient-to-br from-primary-500 to-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Why teams brag about moving to Emplora
              </h2>
              <p className="text-primary-100 text-lg mb-8">
                Because it does not just look polished. It actually closes the loop between workforce data, approvals, payroll, and employee delivery.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                    <span className="text-white">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-white rounded-xl">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Clock className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Time Saved Weekly</p>
                      <p className="text-2xl font-bold text-green-600">5+ Hours</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-white rounded-xl">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Approval Speed</p>
                      <p className="text-2xl font-bold text-blue-600">Much Faster</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-white rounded-xl">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Shield className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Payroll Errors Reduced</p>
                      <p className="text-2xl font-bold text-purple-600">95%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Loved by HR teams that are tired of patchwork systems
            </h2>
            <p className="text-xl text-gray-600">
              The value is not just in features. It is in finally having the whole process connected.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.name} className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, index) => (
                    <Star key={index} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 leading-relaxed">"{testimonial.text}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-bold">{testimonial.image}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-gray-500 text-sm">{testimonial.role}, {testimonial.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Ready to run your workforce from one serious system?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Start with an HR account, onboard your team, import employees from Excel if needed, and run the entire workflow from your dashboard.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Globe className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Web + Mobile Together</h3>
                    <p className="text-gray-600">Leadership runs the dashboard while employees clock, request leave, and download paystubs from mobile.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Lock className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Role-Protected Access</h3>
                    <p className="text-gray-600">Managers get the oversight they need while HR keeps payroll, employee setup, and admin controls.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bell className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Operational Confidence</h3>
                    <p className="text-gray-600">Export reports, generate backups, and keep your HR data protected and ready when you need it.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-8">
              {submitSuccess ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
                  <p className="text-gray-600 mb-6">We have your message at support@emplora.org and will reach out within 24 hours.</p>
                  <button onClick={() => setSubmitSuccess(false)} className="text-primary-600 font-medium hover:text-primary-700">
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Contact Us</h3>
                  <p className="text-sm text-gray-500 mb-5">This form sends directly to <span className="font-semibold text-gray-700">support@emplora.org</span>.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" required value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Your Company Name" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" required value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="Your Full Name" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="you@company.com" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="(555) 000-0000" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Employees</label>
                      <select value={formData.employees} onChange={(e) => setFormData({ ...formData, employees: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                        <option value="">Select range</option>
                        <option value="1-10">1-10 employees</option>
                        <option value="11-50">11-50 employees</option>
                        <option value="51-200">51-200 employees</option>
                        <option value="201-500">201-500 employees</option>
                        <option value="500+">500+ employees</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                      <textarea rows={3} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none" placeholder="Tell us how you want to use Emplora..." />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {isSubmitting ? 'Sending...' : <>Contact Us <ArrowRight className="w-5 h-5" /></>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <img src="/emplora-logo.png" alt="Emplora" className="h-10 w-auto mb-4" />
              <p className="text-gray-400 max-w-md">
                Emplora gives modern teams one connected place to manage people, approvals, payroll, paystubs, exports, and backup-ready workforce data.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#benefits" className="text-gray-400 hover:text-white transition-colors">Benefits</a></li>
                <li><a href="#testimonials" className="text-gray-400 hover:text-white transition-colors">Reviews</a></li>
                <li><button onClick={() => navigate('/login')} className="text-gray-400 hover:text-white transition-colors">Sign In</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#contact" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                <li><button onClick={() => navigate('/signup')} className="text-gray-400 hover:text-white transition-colors">Create HR Account</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">© 2026 Emplora. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
