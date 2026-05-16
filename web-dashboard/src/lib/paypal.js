const DEFAULT_PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || ''

function getPayPalScriptId(clientId, environment) {
  return `paypal-sdk-${environment || 'live'}-${clientId.slice(0, 8)}`
}

export async function loadPayPalSdk({ clientId = DEFAULT_PAYPAL_CLIENT_ID, environment = 'live' } = {}) {
  if (typeof window === 'undefined') {
    throw new Error('PayPal checkout can only load in the browser.')
  }

  if (!clientId) {
    throw new Error('PayPal client ID is not configured.')
  }

  if (window.paypal?.Buttons) {
    return window.paypal
  }

  const scriptId = getPayPalScriptId(clientId, environment)
  const existing = document.getElementById(scriptId)

  if (!existing) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription`
      script.async = true
      script.onload = resolve
      script.onerror = () => reject(new Error('PayPal checkout failed to load.'))
      document.head.appendChild(script)
    })
  }

  if (!window.paypal?.Buttons) {
    throw new Error('PayPal checkout is not available yet.')
  }

  return window.paypal
}

function createCheckoutModal(title) {
  const overlay = document.createElement('div')
  overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 px-4'

  const panel = document.createElement('div')
  panel.className = 'w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl'

  const header = document.createElement('div')
  header.className = 'mb-5 flex items-start justify-between gap-4'

  const heading = document.createElement('div')
  heading.innerHTML = `<p class="text-sm font-semibold text-primary-600">Emplora Billing</p><h2 class="mt-1 text-xl font-bold text-slate-900">${title}</h2>`

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50'
  closeButton.textContent = 'Close'

  const buttonHost = document.createElement('div')
  buttonHost.id = `paypal-buttons-${Date.now()}`

  header.appendChild(heading)
  header.appendChild(closeButton)
  panel.appendChild(header)
  panel.appendChild(buttonHost)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return {
    buttonHost,
    closeButton,
    destroy: () => overlay.remove(),
  }
}

export async function openPayPalSubscriptionCheckout({
  clientId = DEFAULT_PAYPAL_CLIENT_ID,
  environment = 'live',
  plan,
  companyId,
  customerEmail,
  onApproved,
} = {}) {
  if (!plan?.paypal_plan_id) {
    throw new Error('This PayPal plan is not configured yet.')
  }
  if (!companyId) {
    throw new Error('Company workspace is missing for checkout.')
  }

  const paypal = await loadPayPalSdk({ clientId, environment })
  const modal = createCheckoutModal(`Subscribe to ${plan.display_name}`)

  return new Promise((resolve, reject) => {
    modal.closeButton.addEventListener('click', () => {
      modal.destroy()
      resolve(null)
    })

    paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'subscribe',
      },
      createSubscription: (_data, actions) =>
        actions.subscription.create({
          plan_id: plan.paypal_plan_id,
          custom_id: companyId,
          subscriber: customerEmail
            ? {
                email_address: customerEmail,
              }
            : undefined,
        }),
      onApprove: async (data) => {
        modal.destroy()
        if (onApproved) {
          await onApproved(data)
        }
        resolve(data)
      },
      onError: (error) => {
        modal.destroy()
        reject(error)
      },
    }).render(modal.buttonHost)
  })
}
