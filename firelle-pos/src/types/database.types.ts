export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cashflows: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_manual: boolean
          occurred_at: string
          transaction_id: string | null
          type: Database["public"]["Enums"]["cashflow_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_manual?: boolean
          occurred_at?: string
          transaction_id?: string | null
          type: Database["public"]["Enums"]["cashflow_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_manual?: boolean
          occurred_at?: string
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["cashflow_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflows_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflows_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflows_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_cashier"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          is_walk_in: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_walk_in?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_walk_in?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_counters: {
        Row: {
          invoice_date: string
          last_number: number
        }
        Insert: {
          invoice_date: string
          last_number?: number
        }
        Update: {
          invoice_date?: string
          last_number?: number
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          position: number
          product_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          position?: number
          product_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          position?: number
          product_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_cashier"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          cost_price: number
          created_at: string
          deleted_at: string | null
          id: string
          is_deleted: boolean
          min_stock: number
          name: string
          selling_price: number
          sku: string | null
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          min_stock?: number
          name: string
          selling_price: number
          sku?: string | null
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          cost_price?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          min_stock?: number
          name?: string
          selling_price?: number
          sku?: string | null
          stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          allow_negative_stock: boolean
          created_at: string
          low_stock_default: number
          receipt_footer: string | null
          receipt_paper: string
          singleton: boolean
          store_address: string | null
          store_name: string
          store_phone: string | null
          updated_at: string
        }
        Insert: {
          allow_negative_stock?: boolean
          created_at?: string
          low_stock_default?: number
          receipt_footer?: string | null
          receipt_paper?: string
          singleton?: boolean
          store_address?: string | null
          store_name?: string
          store_phone?: string | null
          updated_at?: string
        }
        Update: {
          allow_negative_stock?: boolean
          created_at?: string
          low_stock_default?: number
          receipt_footer?: string | null
          receipt_paper?: string
          singleton?: boolean
          store_address?: string | null
          store_name?: string
          store_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          qty_change: number
          reason: Database["public"]["Enums"]["adjust_reason"] | null
          stock_after: number
          transaction_id: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id: string
          qty_change: number
          reason?: Database["public"]["Enums"]["adjust_reason"] | null
          stock_after: number
          transaction_id?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string
          qty_change?: number
          reason?: Database["public"]["Enums"]["adjust_reason"] | null
          stock_after?: number
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_cashier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_cashier"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          cost_price: number
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          qty: number
          selling_price: number
          subtotal: number
          subtotal_profit: number
          transaction_id: string
          unit: string
        }
        Insert: {
          cost_price: number
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          qty: number
          selling_price: number
          subtotal: number
          subtotal_profit: number
          transaction_id: string
          unit: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          selling_price?: number
          subtotal?: number
          subtotal_profit?: number
          transaction_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_cashier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_cashier"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_paid: number
          change_amount: number
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string
          discount_amount: number
          id: string
          idempotency_key: string | null
          invoice_number: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["txn_status"]
          subtotal_amount: number
          total_amount: number
          total_cost: number
          total_profit: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid: number
          change_amount?: number
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by: string
          discount_amount?: number
          id?: string
          idempotency_key?: string | null
          invoice_number: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["txn_status"]
          subtotal_amount: number
          total_amount: number
          total_cost?: number
          total_profit?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number
          change_amount?: number
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          discount_amount?: number
          id?: string
          idempotency_key?: string | null
          invoice_number?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["txn_status"]
          subtotal_amount?: number
          total_amount?: number
          total_cost?: number
          total_profit?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      product_images_cashier: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string | null
          is_primary: boolean | null
          position: number | null
          product_id: string | null
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string | null
          is_primary?: boolean | null
          position?: number | null
          product_id?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string | null
          is_primary?: boolean | null
          position?: number | null
          product_id?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_cashier"
            referencedColumns: ["id"]
          },
        ]
      }
      products_admin: {
        Row: {
          barcode: string | null
          cost_price: number | null
          created_at: string | null
          deleted_at: string | null
          id: string | null
          is_deleted: boolean | null
          min_stock: number | null
          name: string | null
          selling_price: number | null
          sku: string | null
          stock: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          cost_price?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          is_deleted?: boolean | null
          min_stock?: number | null
          name?: string | null
          selling_price?: number | null
          sku?: string | null
          stock?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          cost_price?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          is_deleted?: boolean | null
          min_stock?: number | null
          name?: string | null
          selling_price?: number | null
          sku?: string | null
          stock?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      products_cashier: {
        Row: {
          barcode: string | null
          created_at: string | null
          deleted_at: string | null
          id: string | null
          is_deleted: boolean | null
          min_stock: number | null
          name: string | null
          selling_price: number | null
          sku: string | null
          stock: number | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          is_deleted?: boolean | null
          min_stock?: number | null
          name?: string | null
          selling_price?: number | null
          sku?: string | null
          stock?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string | null
          is_deleted?: boolean | null
          min_stock?: number | null
          name?: string | null
          selling_price?: number | null
          sku?: string | null
          stock?: number | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transaction_items_admin: {
        Row: {
          cost_price: number | null
          created_at: string | null
          id: string | null
          product_id: string | null
          product_name: string | null
          qty: number | null
          selling_price: number | null
          subtotal: number | null
          subtotal_profit: number | null
          transaction_id: string | null
          unit: string | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          product_name?: string | null
          qty?: number | null
          selling_price?: number | null
          subtotal?: number | null
          subtotal_profit?: number | null
          transaction_id?: string | null
          unit?: string | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          product_name?: string | null
          qty?: number | null
          selling_price?: number | null
          subtotal?: number | null
          subtotal_profit?: number | null
          transaction_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_cashier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_cashier"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items_cashier: {
        Row: {
          created_at: string | null
          id: string | null
          product_id: string | null
          product_name: string | null
          qty: number | null
          selling_price: number | null
          subtotal: number | null
          transaction_id: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          product_name?: string | null
          qty?: number | null
          selling_price?: number | null
          subtotal?: number | null
          transaction_id?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          product_id?: string | null
          product_name?: string | null
          qty?: number | null
          selling_price?: number | null
          subtotal?: number | null
          transaction_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_cashier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions_cashier"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_admin: {
        Row: {
          amount_paid: number | null
          change_amount: number | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          id: string | null
          idempotency_key: string | null
          invoice_number: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          status: Database["public"]["Enums"]["txn_status"] | null
          subtotal_amount: number | null
          total_amount: number | null
          total_cost: number | null
          total_profit: number | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_paid?: number | null
          change_amount?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          id?: string | null
          idempotency_key?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["txn_status"] | null
          subtotal_amount?: number | null
          total_amount?: number | null
          total_cost?: number | null
          total_profit?: number | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_paid?: number | null
          change_amount?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          id?: string | null
          idempotency_key?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["txn_status"] | null
          subtotal_amount?: number | null
          total_amount?: number | null
          total_cost?: number | null
          total_profit?: number | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_cashier: {
        Row: {
          amount_paid: number | null
          change_amount: number | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          id: string | null
          invoice_number: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          status: Database["public"]["Enums"]["txn_status"] | null
          subtotal_amount: number | null
          total_amount: number | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          change_amount?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          id?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["txn_status"] | null
          subtotal_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          change_amount?: number | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          id?: string | null
          invoice_number?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["txn_status"] | null
          subtotal_amount?: number | null
          total_amount?: number | null
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_stock: {
        Args: {
          p_delta: number
          p_note?: string
          p_product_id: string
          p_reason: Database["public"]["Enums"]["adjust_reason"]
        }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          qty_change: number
          reason: Database["public"]["Enums"]["adjust_reason"] | null
          stock_after: number
          transaction_id: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_transaction: {
        Args: {
          p_amount_paid: number
          p_client_id: string
          p_discount_amount?: number
          p_idempotency_key: string
          p_items: Json
          p_notes?: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: {
          amount_paid: number | null
          change_amount: number | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          id: string | null
          invoice_number: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          status: Database["public"]["Enums"]["txn_status"] | null
          subtotal_amount: number | null
          total_amount: number | null
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "transactions_cashier"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      next_invoice_number: { Args: { p_date?: string }; Returns: string }
      void_transaction: {
        Args: { p_reason?: string; p_transaction_id: string }
        Returns: {
          amount_paid: number
          change_amount: number
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string
          discount_amount: number
          id: string
          idempotency_key: string | null
          invoice_number: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["txn_status"]
          subtotal_amount: number
          total_amount: number
          total_cost: number
          total_profit: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      adjust_reason: "RESTOCK" | "DAMAGED" | "LOST" | "STOCK_OPNAME" | "OTHER"
      cashflow_type: "IN" | "OUT"
      payment_method: "CASH" | "QRIS" | "TRANSFER"
      stock_movement_type:
        | "INITIAL"
        | "SALE"
        | "VOID_RETURN"
        | "ADJUSTMENT_IN"
        | "ADJUSTMENT_OUT"
      txn_status: "COMPLETED" | "VOID"
      user_role: "ADMIN" | "CASHIER"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      adjust_reason: ["RESTOCK", "DAMAGED", "LOST", "STOCK_OPNAME", "OTHER"],
      cashflow_type: ["IN", "OUT"],
      payment_method: ["CASH", "QRIS", "TRANSFER"],
      stock_movement_type: [
        "INITIAL",
        "SALE",
        "VOID_RETURN",
        "ADJUSTMENT_IN",
        "ADJUSTMENT_OUT",
      ],
      txn_status: ["COMPLETED", "VOID"],
      user_role: ["ADMIN", "CASHIER"],
    },
  },
} as const
