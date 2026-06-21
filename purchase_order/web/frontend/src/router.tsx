import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  redirect,
} from '@tanstack/react-router'

import { useAuth } from '@/stores/auth'

import { LoginPage } from '@/pages/LoginPage'
import { CompanySelectPage } from '@/pages/CompanySelectPage'
import { MainShell } from '@/pages/MainShell'
import { ConvertTab } from '@/pages/ConvertTab'
import { PartnersTab } from '@/pages/PartnersTab'
import { ItemsTab } from '@/pages/ItemsTab'
import { PricesTab } from '@/pages/PricesTab'
import { DeliveryTab } from '@/pages/DeliveryTab'
import { CollectionsTab } from '@/pages/CollectionsTab'
import { PaymentsTab } from '@/pages/PaymentsTab'
import { InvoiceTab } from '@/pages/InvoiceTab'
import { LedgerTab } from '@/pages/LedgerTab'

const rootRoute = createRootRoute({ component: () => <Outlet /> })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const companySelectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-select',
  beforeLoad: () => {
    if (!useAuth.getState().token) throw redirect({ to: '/login' })
  },
  component: CompanySelectPage,
})

const mainRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/main',
  beforeLoad: () => {
    const { token, company } = useAuth.getState()
    if (!token) throw redirect({ to: '/login' })
    if (!company) throw redirect({ to: '/company-select' })
  },
  component: MainShell,
})

const convertRoute = createRoute({
  getParentRoute: () => mainRoute, path: '/', component: ConvertTab,
})
const partnersRoute = createRoute({
  getParentRoute: () => mainRoute, path: '/partners', component: PartnersTab,
})
const itemsRoute = createRoute({
  getParentRoute: () => mainRoute, path: '/items', component: ItemsTab,
})
const pricesRoute = createRoute({
  getParentRoute: () => mainRoute, path: '/prices', component: PricesTab,
})
const deliveryRoute = createRoute({
  getParentRoute: () => mainRoute, path: '/delivery', component: DeliveryTab,
})
const collectionsRoute = createRoute({
  getParentRoute: () => mainRoute, path: '/collections', component: CollectionsTab,
})
const paymentsRoute = createRoute({
  getParentRoute: () => mainRoute, path: '/payments', component: PaymentsTab,
})
const invoiceRoute = createRoute({
  getParentRoute: () => mainRoute, path: '/invoice', component: InvoiceTab,
})
const ledgerRoute = createRoute({
  getParentRoute: () => mainRoute, path: '/ledger', component: LedgerTab,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    const { token, company } = useAuth.getState()
    if (!token) throw redirect({ to: '/login' })
    if (!company) throw redirect({ to: '/company-select' })
    throw redirect({ to: '/main' })
  },
  component: () => null,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  companySelectRoute,
  mainRoute.addChildren([
    convertRoute,
    partnersRoute,
    itemsRoute,
    pricesRoute,
    deliveryRoute,
    collectionsRoute,
    paymentsRoute,
    invoiceRoute,
    ledgerRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
