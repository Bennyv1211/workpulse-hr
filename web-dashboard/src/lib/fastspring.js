const DEFAULT_FASTSPRING_SCRIPT_URL =
  import.meta.env.VITE_FASTSPRING_SCRIPT_URL || 'https://sbl.onfastspring.com/sbl/1.0.7/fastspring-builder.min.js'

const DEFAULT_FASTSPRING_STOREFRONT =
  import.meta.env.VITE_FASTSPRING_STOREFRONT || 'emplora.test.onfastspring.com/popup-emplora'

function getExistingFastSpringScript() {
  return document.getElementById('fsc-api')
}

export async function loadFastSpringBuilder({
  scriptUrl = DEFAULT_FASTSPRING_SCRIPT_URL,
  storefront = DEFAULT_FASTSPRING_STOREFRONT,
} = {}) {
  if (typeof window === 'undefined') {
    throw new Error('FastSpring can only load in the browser.')
  }

  const existing = getExistingFastSpringScript()
  const needsReplacement =
    existing &&
    (existing.getAttribute('src') !== scriptUrl ||
      existing.getAttribute('data-storefront') !== storefront)

  if (needsReplacement) {
    existing.remove()
    delete window.fastspring
  }

  if (!getExistingFastSpringScript()) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.id = 'fsc-api'
      script.src = scriptUrl
      script.type = 'text/javascript'
      script.setAttribute('data-storefront', storefront)
      script.onload = resolve
      script.onerror = () => reject(new Error('FastSpring checkout failed to load.'))
      document.head.appendChild(script)
    })
  }

  if (!window.fastspring?.builder) {
    throw new Error('FastSpring builder is not available yet.')
  }

  return window.fastspring.builder
}

export async function openFastSpringCheckout({
  productPath,
  scriptUrl = DEFAULT_FASTSPRING_SCRIPT_URL,
  storefront = DEFAULT_FASTSPRING_STOREFRONT,
  customerEmail,
  firstName,
  lastName,
  companyId,
  companyName,
  planId,
} = {}) {
  if (!productPath) {
    throw new Error('A FastSpring product path is required.')
  }

  const builder = await loadFastSpringBuilder({ scriptUrl, storefront })
  builder.push({
    reset: true,
    paymentContact: customerEmail
      ? {
          email: customerEmail,
          firstName: firstName || '',
          lastName: lastName || '',
          company: companyName || '',
        }
      : undefined,
    tags: {
      source: 'emplora_web_dashboard',
      company_id: companyId || '',
      company_name: companyName || '',
      plan_id: planId || '',
      product_path: productPath,
      customer_email: customerEmail || '',
    },
    products: [{ path: productPath, quantity: 1 }],
  })
  builder.checkout()
}

export function getDefaultFastSpringConfig() {
  return {
    scriptUrl: DEFAULT_FASTSPRING_SCRIPT_URL,
    storefront: DEFAULT_FASTSPRING_STOREFRONT,
  }
}
