import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import api from '../lib/api'
import { openFastSpringCheckout } from '../lib/fastspring'
import { hasActiveSubscription } from '../lib/roles'

function formatDateTime(value) {
  if (!value) return 'Not available yet'
  return new Date(value).toLocaleString()
}

function formatStatusLabel(value) {
  if (!value) return 'Inactive'
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function getStatusTone(status) {
  switch (status) {
    case 'active':
    case 'trial':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'canceled':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'past_due':
    case 'deactivated':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function Billing() {
  const navigate = useNavigate()
  const [launchingPlan, setLaunchingPlan] = React.useState(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['billing-subscription'],
    queryFn: async () => {
      const response = await api.get('/billing/subscription')
      return response.data
    },
    refetchInterval: 10000,
  })

  const handleCheckout = async (plan) => {
    setLaunchingPlan(plan.plan_id)
    try {
      await openFastSpringCheckout({
        productPath: plan.product_path,
        scriptUrl: data?.storefront_script_url,
        storefront: data?.storefront_value,
      })
    } catch (error) {
      console.error('Failed to open FastSpring checkout:', error)
      alert(error.message || 'Unable to open the billing checkout right now.')
    } finally {
      setLaunchingPlan(null)
    }
  }

  if (isLoading) {
    return (
      <div className="card min-h-[320px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading billing workspace...
        </div>
      </div>
    )
  }

  const plans = data?.plans || []
  const currentPlanId = data?.plan_id
  const hasManagementUrl = Boolean(data?.management_url || data?.invoice_url)
  const subscriptionActive = hasActiveSubscription(data?.subscription_status)

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions & Billing</h1>
          <p className="text-gray-500">Manage your Emplora workspace plan, subscription status, and renewal state.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {subscriptionActive && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
            >
              Enter Dashboard
            </button>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-secondary"
          >
            Refresh Status
          </button>
          <button
            type="button"
            onClick={() => {
              const link = data?.management_url || data?.invoice_url
              if (!link) {
                alert('A FastSpring management link will appear here after the billing account is fully available.')
                return
              }
              window.open(link, '_blank', 'noopener,noreferrer')
            }}
            className="btn-primary inline-flex items-center gap-2"
          >
            Manage Subscription
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Workspace</p>
              <p className="text-xl font-bold text-gray-900 mt-2">{data?.company_name}</p>
            </div>
            <div className="p-3 rounded-2xl bg-primary-50">
              <ShieldCheck className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Subscription Status</p>
              <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getStatusTone(data?.subscription_status)}`}>
                {formatStatusLabel(data?.subscription_status)}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50">
              <BadgeDollarSign className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Current Plan</p>
              <p className="text-xl font-bold text-gray-900 mt-2">{data?.plan_name || 'No active plan yet'}</p>
              <p className="text-sm text-gray-500 mt-2">
                {data?.product_path || 'Choose a plan below to activate this workspace.'}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-sky-50">
              <CreditCard className="w-5 h-5 text-sky-600" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">FastSpring Mode</p>
              <p className="text-xl font-bold text-gray-900 mt-2">
                {data?.storefront_environment === 'live' ? 'Live Storefront' : 'Test Storefront'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {data?.storefront_value}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50">
              <Wallet className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="card">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Choose or upgrade your plan</h2>
            <p className="text-sm text-gray-500 mt-1">Use the same FastSpring checkout from inside your HR dashboard to activate or upgrade this workspace.</p>
          </div>
            <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(data?.subscription_status)}`}>
              {formatStatusLabel(data?.access_state)}
            </div>
          </div>

          {!subscriptionActive && (
            <div className="mb-6 rounded-3xl border border-primary-100 bg-primary-50 px-5 py-4">
              <p className="text-sm font-semibold text-primary-700">Complete your plan setup to unlock the HR dashboard</p>
              <p className="mt-1 text-sm text-primary-600">
                Your company workspace has been created. Once payment succeeds and FastSpring sends the webhook back, this page will refresh and unlock full HR dashboard access automatically.
              </p>
            </div>
          )}

          <div className="grid xl:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isCurrent = currentPlanId === plan.plan_id
              return (
                <div
                  key={plan.plan_id}
                  className={`rounded-3xl border p-6 transition-all ${
                    isCurrent ? 'border-primary-300 bg-primary-50/70 shadow-lg' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {plan.employee_range}
                  </div>
                  <h3 className="mt-5 text-2xl font-bold text-gray-900">{plan.display_name.replace('Emplora ', '')}</h3>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900">${Number(plan.price_usd).toFixed(0)}</span>
                    <span className="pb-1 text-gray-500">/month</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-gray-600">{plan.description}</p>

                  <div className="mt-6 space-y-3">
                    {[
                      'Attendance and leave workflows',
                      'Payroll review and paystubs',
                      'Web dashboard plus mobile support',
                    ].map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCheckout(plan)}
                    disabled={launchingPlan === plan.plan_id || isCurrent}
                    className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    }`}
                  >
                    {launchingPlan === plan.plan_id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Opening Checkout...
                      </>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : (
                      <>
                        {currentPlanId ? `Switch to ${plan.display_name.replace('Emplora ', '')}` : `Choose ${plan.display_name.replace('Emplora ', '')}`}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900">Billing sync details</h2>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Customer Email</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{data?.customer_email || 'Will populate after first successful checkout'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Last Billing Event</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{data?.last_event_type || 'No webhook received yet'}</p>
                <p className="text-xs text-gray-500 mt-1">{formatDateTime(data?.last_event_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Last Successful Charge</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{formatDateTime(data?.last_charge_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">FastSpring Subscription ID</p>
                <p className="text-sm font-medium text-gray-800 mt-1 break-all">{data?.fastspring_subscription_id || 'Will populate after activation'}</p>
              </div>
            </div>
          </div>

          <div className="card bg-slate-950 text-white">
            <h2 className="text-lg font-semibold">Webhook-ready workspace</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Once FastSpring posts webhook events to your backend, this company workspace updates automatically for new paid signups, rebills, canceled subscriptions, and failed charges.
            </p>
            <div className="mt-5 space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-1" />
                <span>New paid HR accounts become active automatically.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-1" />
                <span>Renewals keep the subscription active without manual HR intervention.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-1" />
                <span>Failed or deactivated subscriptions move the workspace into a limited state.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-1" />
                <span>The current plan and billing status stay attached to the company workspace record.</span>
              </div>
            </div>
            {!hasManagementUrl && (
              <p className="mt-5 text-xs text-slate-400">
                A FastSpring management or invoice link will appear here once your store sends the first full webhook payload back to Emplora.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
