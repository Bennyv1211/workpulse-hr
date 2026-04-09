import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  MapPin,
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
  Bell
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate sending to email (in production, this would call your backend)
    try {
      // Here you would typically send to your backend which sends an email
      await new Promise(resolve => setTimeout(resolve, 1500))
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
    } finally {
      setIsSubmitting(false)
    }
  }

  const features = [
    {
      icon: Clock,
      title: 'Smart Time Tracking',
      description: 'Effortless clock-in/out with automatic overtime calculation and break tracking.',
      color: 'bg-blue-500'
    },
    {
      icon: MapPin,
      title: 'GPS Geofencing',
      description: 'Ensure employees clock in from approved locations with 5-mile radius verification.',
      color: 'bg-green-500'
    },
    {
      icon: Users,
      title: 'Team Management',
      description: 'Organize employees by department, manage roles, and track performance.',
      color: 'bg-purple-500'
    },
    {
      icon: BarChart3,
      title: 'Real-time Analytics',
      description: 'Beautiful dashboards with attendance trends, productivity metrics, and insights.',
      color: 'bg-orange-500'
    },
    {
      icon: Shield,
      title: 'Role-based Access',
      description: 'Secure permissions for employees, managers, HR, and administrators.',
      color: 'bg-red-500'
    },
    {
      icon: Smartphone,
      title: 'Mobile First',
      description: 'Native mobile apps for Android with offline support.',
      color: 'bg-teal-500'
    }
  ]

  const benefits = [
    'Reduce time theft by up to 80%',
    'Save 5+ hours per week on payroll',
    'Eliminate buddy punching completely',
    'Real-time visibility into workforce',
    'Automated compliance reporting',
    'Seamless payroll integration'
  ]

  const testimonials = [
    {
      name: 'Sarah Mitchell',
      role: 'HR Director',
      company: 'TechFlow Inc.',
      image: 'SM',
      rating: 5,
      text: 'Emplora transformed our attendance management. We went from spreadsheets to a fully automated system in just one week. The GPS geofencing feature alone saved us thousands in overtime disputes.'
    },
    {
      name: 'Michael Chen',
      role: 'Operations Manager',
      company: 'BuildRight Construction',
      image: 'MC',
      rating: 5,
      text: 'Managing 200+ field workers was a nightmare before Emplora. Now I can see exactly who\'s on site in real-time. The mobile app is intuitive and works even without internet.'
    },
    {
      name: 'Jessica Rodriguez',
      role: 'CEO',
      company: 'GreenLeaf Restaurants',
      image: 'JR',
      rating: 5,
      text: 'We\'ve reduced payroll processing time by 75%. The auto clock-out feature ensures we never miss a punch, and the reports make compliance audits a breeze.'
    }
  ]

  const stats = [
    { value: '10,000+', label: 'Employees Tracked' },
    { value: '500+', label: 'Businesses Trust Us' },
    { value: '99.9%', label: 'Uptime Guaranteed' },
    { value: '4.9/5', label: 'Customer Rating' }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/emplora-logo.png" alt="Emplora" className="h-8 w-auto" />
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#benefits" className="text-gray-600 hover:text-gray-900 transition-colors">Benefits</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors">Reviews</a>
              <a href="#contact" className="text-gray-600 hover:text-gray-900 transition-colors">Contact</a>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Sign In
              </button>
              <a
                href="#contact"
                className="px-5 py-2.5 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/25"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary-50 via-white to-purple-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 rounded-full mb-6">
                <Zap className="w-4 h-4 text-primary-600" />
                <span className="text-primary-700 text-sm font-medium">Trusted by 500+ businesses</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Smart Attendance
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-purple-600"> Made Simple</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Emplora is the all-in-one workforce management platform that helps businesses track time, manage employees, and streamline payroll — all from one beautiful dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-all shadow-xl shadow-primary-500/30 hover:shadow-2xl hover:shadow-primary-500/40 hover:-translate-y-0.5"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </a>
                <button className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all border border-gray-200">
                  <Play className="w-5 h-5 text-primary-500" />
                  Watch Demo
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-6 transform rotate-2 hover:rotate-0 transition-transform duration-300">
                <img 
                  src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=500&fit=crop" 
                  alt="Dashboard Preview" 
                  className="rounded-xl w-full"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-green-500 text-white p-4 rounded-xl shadow-lg z-20">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8" />
                  <div>
                    <p className="font-bold">98% Accuracy</p>
                    <p className="text-green-100 text-sm">GPS Verification</p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-purple-500 text-white p-4 rounded-xl shadow-lg z-20">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8" />
                  <div>
                    <p className="font-bold">Real-time</p>
                    <p className="text-purple-100 text-sm">Team Tracking</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-4xl font-bold text-white mb-2">{stat.value}</p>
                <p className="text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Manage Your Workforce
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From time tracking to payroll integration, Emplora provides all the tools you need to manage your team efficiently.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-8 bg-white rounded-2xl border border-gray-100 hover:border-primary-200 hover:shadow-xl transition-all duration-300"
              >
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

      {/* Benefits Section */}
      <section id="benefits" className="py-24 bg-gradient-to-br from-primary-500 to-primary-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Why Businesses Choose Emplora
              </h2>
              <p className="text-primary-100 text-lg mb-8">
                Join hundreds of companies that have transformed their workforce management with our intuitive platform.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
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
                      <p className="font-semibold text-gray-900">Productivity Increase</p>
                      <p className="text-2xl font-bold text-blue-600">32%</p>
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

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Loved by HR Teams Everywhere
            </h2>
            <p className="text-xl text-gray-600">
              See what our customers have to say about Emplora
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
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

      {/* Contact Form Section */}
      <section id="contact" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Ready to Transform Your Workforce Management?
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Get started with a free trial. No credit card required. Our team will help you get set up in minutes.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Globe className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Works Everywhere</h3>
                    <p className="text-gray-600">Web dashboard, iOS app, and Android app included.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Lock className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Enterprise Security</h3>
                    <p className="text-gray-600">SOC 2 compliant with end-to-end encryption.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bell className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">24/7 Support</h3>
                    <p className="text-gray-600">Dedicated support team ready to help anytime.</p>
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
                  <p className="text-gray-600 mb-6">We've received your request. Our team will contact you within 24 hours.</p>
                  <button
                    onClick={() => setSubmitSuccess(false)}
                    className="text-primary-600 font-medium hover:text-primary-700"
                  >
                    Submit another request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Get Started Today</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={formData.businessName}
                          onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                          placeholder="Your Company Name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          required
                          value={formData.contactName}
                          onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                          placeholder="Your Full Name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                            placeholder="you@company.com"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                            placeholder="(555) 000-0000"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Employees</label>
                      <select
                        value={formData.employees}
                        onChange={(e) => setFormData({...formData, employees: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                      >
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
                      <textarea
                        rows={3}
                        value={formData.message}
                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                        placeholder="Tell us about your needs..."
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Request Demo
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-center text-sm text-gray-500 mt-4">
                    By submitting, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <img src="/emplora-logo.png" alt="Emplora" className="h-10 w-auto mb-4 brightness-0 invert" />
              <p className="text-gray-400 max-w-md">
                Emplora is the modern workforce management platform trusted by businesses worldwide. Simplify attendance, streamline payroll, and empower your team.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">API Docs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Careers</a></li>
                <li><a href="#contact" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © 2026 Emplora. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-gray-500 hover:text-white transition-colors text-sm">Privacy Policy</a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors text-sm">Terms of Service</a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors text-sm">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
