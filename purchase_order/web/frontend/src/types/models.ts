// Backend(DRF) 응답 타입. apps/*/serializers.py와 1:1 매칭.

export interface Partner {
  id: number
  code: string
  name: string
  biz_class: 'customer' | 'vendor' | 'both'
  biz_no: string
  rep_name: string
  biz_kind: string
  biz_item: string
  address: string
  tel: string
  fax: string
  email: string
  vat_type: 'vat' | 'none'
  output_name: string
  memo: string
  is_active: boolean
  accounts: PartnerAccount[]
}

export interface PartnerAccount {
  id: number
  bank: string
  account_no: string
  holder: string
  nickname: string
  is_default: boolean
  is_active: boolean
}

export interface Item {
  id: number
  code: string
  partner: number | null
  partner_name: string | null
  partner_code: string | null
  name: string
  spec: string
  procure_type: string
  account_type: string
  unit_in: string
  unit_out: string
  unit_stock: string
  invoice_print_name: string
  memo: string
  is_active: boolean
}

export interface PartnerPrice {
  id: number
  partner: number
  partner_code: string
  partner_name: string
  item: number
  item_code: string
  item_name: string
  item_spec: string
  item_unit: string
  sale_price: string
  purchase_price: string
  effective_from: string
  memo: string
  is_active: boolean
}

export interface DeliveryLine {
  id: number
  item: number
  item_code: string
  item_name: string
  spec: string
  unit: string
  qty: string
  unit_price: string
  supply_amount: string
  vat_amount: string
  total: string
  note: string
}

export interface DeliveryOrder {
  id: number
  order_no: string
  order_date: string
  partner: number
  partner_code: string
  partner_name: string
  vat_type: 'vat' | 'none'
  tax_type: 'taxable' | 'exempt' | 'zero'
  status: 'draft' | 'confirmed' | 'voided'
  note: string
  subtotal: string
  vat_total: string
  total: string
  lines: DeliveryLine[]
}

export interface Collection {
  id: number
  receipt_no: string
  receipt_date: string
  partner: number
  partner_code: string
  partner_name: string
  receipt_type: string
  receipt_type_label: string
  amount: string
  bank_account: number | null
  note: string
}

export interface Payment {
  id: number
  payment_no: string
  payment_date: string
  partner: number
  partner_code: string
  partner_name: string
  payment_type: string
  payment_type_label: string
  amount: string
  bank_account: number | null
  note: string
}

export interface InvoiceData {
  company: { name: string; biz_no: string | null; rep_name: string | null }
  partner: {
    code: string; name: string; biz_no: string; rep_name: string
    address: string; tel: string
  }
  date: string
  vat_type: 'vat' | 'none'
  orders: string[]
  lines: Array<{
    order_no: string; item_code: string; item_name: string
    spec: string; unit: string; qty: string; unit_price: string
    supply_amount: string; vat_amount: string; total: string; note: string
  }>
  subtotal: string
  vat_total: string
  today_total: string
  outstanding_before: string
  paid_today: string
  outstanding_after: string
}

export interface InvoiceSetting {
  print_form: string
  show_supplier_seal: boolean
  show_delivery_addr: boolean
  show_qty_total: boolean
  show_vat: boolean
  show_decimal: boolean
  show_qty: boolean
  show_unit_price: boolean
  show_amount: boolean
  show_total_amount: boolean
  show_receivable: boolean
  representative_type: string
  show_item_memo: boolean
  invoice_memo_field: string
  show_spec: boolean
  show_tax_amount: boolean
  show_today_total: boolean
}

export interface LedgerRow {
  partner_id: number
  partner_code: string
  partner_name: string
  opening: string
  sales?: string
  purchases?: string
  received?: string
  paid?: string
  balance: string
}

export interface LedgerResponse {
  rows: LedgerRow[]
  totals: Record<string, string>
  from: string
  to: string
}
