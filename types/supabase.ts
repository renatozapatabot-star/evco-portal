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
    PostgrestVersion: "14.1"
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
      aduanet_actividades: {
        Row: {
          accion: string | null
          aduana: string | null
          created_at: string | null
          detalle: string | null
          fecha: string | null
          id: number
          idra: string | null
          patente: string | null
          pedimento: string | null
          referencia: string | null
          tenant_id: string | null
          usuario: string | null
        }
        Insert: {
          accion?: string | null
          aduana?: string | null
          created_at?: string | null
          detalle?: string | null
          fecha?: string | null
          id?: number
          idra?: string | null
          patente?: string | null
          pedimento?: string | null
          referencia?: string | null
          tenant_id?: string | null
          usuario?: string | null
        }
        Update: {
          accion?: string | null
          aduana?: string | null
          created_at?: string | null
          detalle?: string | null
          fecha?: string | null
          id?: number
          idra?: string | null
          patente?: string | null
          pedimento?: string | null
          referencia?: string | null
          tenant_id?: string | null
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aduanet_actividades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aduanet_dodas: {
        Row: {
          aduana: string | null
          caat: string | null
          cfdi: string | null
          cove: string | null
          created_at: string | null
          estatus: string | null
          fecha_emision: string | null
          folio: string | null
          id: number
          id_fast: string | null
          niu: string | null
          nombre_solicitante: string | null
          num_gafete: string | null
          num_integracion: string | null
          num_remesas: string | null
          num_transaccion: string | null
          patente: string | null
          pedimento: string | null
          pedimento_americano: string | null
          placas: string | null
          referencia: string | null
          referencia_ped: string | null
          respuesta_val: string | null
          tenant_id: string | null
          tipo: string | null
          tipo_despacho: string | null
          tipo_movimiento: string | null
          tipo_operacion: string | null
          total_niu: string | null
          valor: number | null
          valor_dolar: number | null
        }
        Insert: {
          aduana?: string | null
          caat?: string | null
          cfdi?: string | null
          cove?: string | null
          created_at?: string | null
          estatus?: string | null
          fecha_emision?: string | null
          folio?: string | null
          id?: number
          id_fast?: string | null
          niu?: string | null
          nombre_solicitante?: string | null
          num_gafete?: string | null
          num_integracion?: string | null
          num_remesas?: string | null
          num_transaccion?: string | null
          patente?: string | null
          pedimento?: string | null
          pedimento_americano?: string | null
          placas?: string | null
          referencia?: string | null
          referencia_ped?: string | null
          respuesta_val?: string | null
          tenant_id?: string | null
          tipo?: string | null
          tipo_despacho?: string | null
          tipo_movimiento?: string | null
          tipo_operacion?: string | null
          total_niu?: string | null
          valor?: number | null
          valor_dolar?: number | null
        }
        Update: {
          aduana?: string | null
          caat?: string | null
          cfdi?: string | null
          cove?: string | null
          created_at?: string | null
          estatus?: string | null
          fecha_emision?: string | null
          folio?: string | null
          id?: number
          id_fast?: string | null
          niu?: string | null
          nombre_solicitante?: string | null
          num_gafete?: string | null
          num_integracion?: string | null
          num_remesas?: string | null
          num_transaccion?: string | null
          patente?: string | null
          pedimento?: string | null
          pedimento_americano?: string | null
          placas?: string | null
          referencia?: string | null
          referencia_ped?: string | null
          respuesta_val?: string | null
          tenant_id?: string | null
          tipo?: string | null
          tipo_despacho?: string | null
          tipo_movimiento?: string | null
          tipo_operacion?: string | null
          total_niu?: string | null
          valor?: number | null
          valor_dolar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aduanet_dodas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aduanet_facturas: {
        Row: {
          aduana: string | null
          clave_cliente: string | null
          company_id: string | null
          cove: string | null
          created_at: string | null
          cve_documento: string | null
          dta: number | null
          embalaje: number | null
          fecha_factura: string | null
          fecha_pago: string | null
          fletes: number | null
          id: number
          ieps: number | null
          igi: number | null
          incoterm: string | null
          iva: number | null
          marca_numero: string | null
          moneda: string | null
          nombre_cliente: string | null
          num_factura: string | null
          operacion: string | null
          otros_incrementos: number | null
          patente: string | null
          pedimento: string | null
          peso: number | null
          proveedor: string | null
          referencia: string | null
          rfc: string | null
          seguro: number | null
          tenant_id: string | null
          tenant_slug: string | null
          tipo_cambio: number | null
          totales_incrementales: number | null
          tx_id: string | null
          valor_total: number | null
          valor_usd: number | null
        }
        Insert: {
          aduana?: string | null
          clave_cliente?: string | null
          company_id?: string | null
          cove?: string | null
          created_at?: string | null
          cve_documento?: string | null
          dta?: number | null
          embalaje?: number | null
          fecha_factura?: string | null
          fecha_pago?: string | null
          fletes?: number | null
          id?: number
          ieps?: number | null
          igi?: number | null
          incoterm?: string | null
          iva?: number | null
          marca_numero?: string | null
          moneda?: string | null
          nombre_cliente?: string | null
          num_factura?: string | null
          operacion?: string | null
          otros_incrementos?: number | null
          patente?: string | null
          pedimento?: string | null
          peso?: number | null
          proveedor?: string | null
          referencia?: string | null
          rfc?: string | null
          seguro?: number | null
          tenant_id?: string | null
          tenant_slug?: string | null
          tipo_cambio?: number | null
          totales_incrementales?: number | null
          tx_id?: string | null
          valor_total?: number | null
          valor_usd?: number | null
        }
        Update: {
          aduana?: string | null
          clave_cliente?: string | null
          company_id?: string | null
          cove?: string | null
          created_at?: string | null
          cve_documento?: string | null
          dta?: number | null
          embalaje?: number | null
          fecha_factura?: string | null
          fecha_pago?: string | null
          fletes?: number | null
          id?: number
          ieps?: number | null
          igi?: number | null
          incoterm?: string | null
          iva?: number | null
          marca_numero?: string | null
          moneda?: string | null
          nombre_cliente?: string | null
          num_factura?: string | null
          operacion?: string | null
          otros_incrementos?: number | null
          patente?: string | null
          pedimento?: string | null
          peso?: number | null
          proveedor?: string | null
          referencia?: string | null
          rfc?: string | null
          seguro?: number | null
          tenant_id?: string | null
          tenant_slug?: string | null
          tipo_cambio?: number | null
          totales_incrementales?: number | null
          tx_id?: string | null
          valor_total?: number | null
          valor_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aduanet_facturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aduanet_transmisiones: {
        Row: {
          aduana: string | null
          archivo: string | null
          created_at: string | null
          fecha_firmado: string | null
          fecha_transmision: string | null
          id: number
          patente: string | null
          pedimento: string | null
          referencia: string | null
          tenant_id: string | null
          tipo: string | null
          usuario: string | null
          validador: string | null
        }
        Insert: {
          aduana?: string | null
          archivo?: string | null
          created_at?: string | null
          fecha_firmado?: string | null
          fecha_transmision?: string | null
          id?: number
          patente?: string | null
          pedimento?: string | null
          referencia?: string | null
          tenant_id?: string | null
          tipo?: string | null
          usuario?: string | null
          validador?: string | null
        }
        Update: {
          aduana?: string | null
          archivo?: string | null
          created_at?: string | null
          fecha_firmado?: string | null
          fecha_transmision?: string | null
          id?: number
          patente?: string | null
          pedimento?: string | null
          referencia?: string | null
          tenant_id?: string | null
          tipo?: string | null
          usuario?: string | null
          validador?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aduanet_transmisiones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_decisions: {
        Row: {
          action_taken: string | null
          autonomy_level: number | null
          company_id: string | null
          confidence: number | null
          corrected_by: string | null
          created_at: string | null
          cycle_id: string
          decision: string
          id: number
          outcome: string | null
          payload: Json | null
          processing_ms: number | null
          reasoning: string | null
          trigger_id: string | null
          trigger_type: string
          was_correct: boolean | null
          workflow: string
        }
        Insert: {
          action_taken?: string | null
          autonomy_level?: number | null
          company_id?: string | null
          confidence?: number | null
          corrected_by?: string | null
          created_at?: string | null
          cycle_id: string
          decision: string
          id?: number
          outcome?: string | null
          payload?: Json | null
          processing_ms?: number | null
          reasoning?: string | null
          trigger_id?: string | null
          trigger_type: string
          was_correct?: boolean | null
          workflow: string
        }
        Update: {
          action_taken?: string | null
          autonomy_level?: number | null
          company_id?: string | null
          confidence?: number | null
          corrected_by?: string | null
          created_at?: string | null
          cycle_id?: string
          decision?: string
          id?: number
          outcome?: string | null
          payload?: Json | null
          processing_ms?: number | null
          reasoning?: string | null
          trigger_id?: string | null
          trigger_type?: string
          was_correct?: boolean | null
          workflow?: string
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          category: string
          client_id: string | null
          confidence: number | null
          content: string
          created_at: string | null
          id: string
          last_validated: string | null
          times_referenced: number | null
          validated_by: string | null
        }
        Insert: {
          category: string
          client_id?: string | null
          confidence?: number | null
          content: string
          created_at?: string | null
          id?: string
          last_validated?: string | null
          times_referenced?: number | null
          validated_by?: string | null
        }
        Update: {
          category?: string
          client_id?: string | null
          confidence?: number | null
          content?: string
          created_at?: string | null
          id?: string
          last_validated?: string | null
          times_referenced?: number | null
          validated_by?: string | null
        }
        Relationships: []
      }
      aguila_mention_routes: {
        Row: {
          active: boolean | null
          clave_cliente: string | null
          created_at: string | null
          escalated: boolean | null
          handle: string
          id: number
          operator_id: string | null
          recipient_role: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          clave_cliente?: string | null
          created_at?: string | null
          escalated?: boolean | null
          handle: string
          id?: number
          operator_id?: string | null
          recipient_role: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          clave_cliente?: string | null
          created_at?: string | null
          escalated?: boolean | null
          handle?: string
          id?: number
          operator_id?: string | null
          recipient_role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      aguila_shadow_log: {
        Row: {
          answer_excerpt: string | null
          company_id: string | null
          created_at: string
          escalated: boolean | null
          id: number
          message_id: string
          metadata: Json | null
          operator_id: string | null
          question_excerpt: string | null
          recipient_role: string | null
          resolved: boolean | null
          response_time_ms: number | null
          sender_role: string
          tools_called: string[] | null
          topic_class: string | null
          user_id: string | null
        }
        Insert: {
          answer_excerpt?: string | null
          company_id?: string | null
          created_at?: string
          escalated?: boolean | null
          id?: number
          message_id: string
          metadata?: Json | null
          operator_id?: string | null
          question_excerpt?: string | null
          recipient_role?: string | null
          resolved?: boolean | null
          response_time_ms?: number | null
          sender_role: string
          tools_called?: string[] | null
          topic_class?: string | null
          user_id?: string | null
        }
        Update: {
          answer_excerpt?: string | null
          company_id?: string | null
          created_at?: string
          escalated?: boolean | null
          id?: number
          message_id?: string
          metadata?: Json | null
          operator_id?: string | null
          question_excerpt?: string | null
          recipient_role?: string | null
          resolved?: boolean | null
          response_time_ms?: number | null
          sender_role?: string
          tools_called?: string[] | null
          topic_class?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      alerts: {
        Row: {
          action: Json | null
          company_id: string
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          severity: string | null
          snoozed_until: string | null
          status: string | null
          title: string
        }
        Insert: {
          action?: Json | null
          company_id: string
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          severity?: string | null
          snoozed_until?: string | null
          status?: string | null
          title: string
        }
        Update: {
          action?: Json | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          severity?: string | null
          snoozed_until?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      anexo24_fracciones: {
        Row: {
          company_id: string | null
          created_at: string | null
          descripcion: string | null
          fraccion: string
          id: number
          num_partes_unicas: number | null
          num_partidas: number | null
          paises_origen: string | null
          proveedores: string | null
          total_usd: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          fraccion: string
          id?: number
          num_partes_unicas?: number | null
          num_partidas?: number | null
          paises_origen?: string | null
          proveedores?: string | null
          total_usd?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          fraccion?: string
          id?: number
          num_partes_unicas?: number | null
          num_partidas?: number | null
          paises_origen?: string | null
          proveedores?: string | null
          total_usd?: number | null
        }
        Relationships: []
      }
      anexo24_numeros_parte: {
        Row: {
          company_id: string | null
          created_at: string | null
          descripcion: string | null
          fraccion: string | null
          id: number
          numero_parte: string
          pais: string | null
          proveedor: string | null
          total_valor_dolar: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          fraccion?: string | null
          id?: number
          numero_parte: string
          pais?: string | null
          proveedor?: string | null
          total_valor_dolar?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          fraccion?: string | null
          id?: number
          numero_parte?: string
          pais?: string | null
          proveedor?: string | null
          total_valor_dolar?: number | null
        }
        Relationships: []
      }
      anexo24_partidas: {
        Row: {
          aduana: string | null
          cantidad: string | null
          clave: string | null
          clave_insumo: string | null
          client_id: string | null
          company_id: string | null
          created_at: string | null
          descripcion: string | null
          factura: string | null
          fecha_factura: string | null
          fecha_pago: string | null
          fecha_presentacion: string | null
          fraccion: string | null
          id: number
          incoterm: string | null
          numero_parte: string | null
          pais_origen: string | null
          pedimento: string
          peso_kg: string | null
          proveedor: string | null
          short_pedimento: string | null
          tax_id: string | null
          tenant_id: string
          tipo_cambio: string | null
          tratado: string | null
          um_comercial: string | null
          valor_dolar: string | null
        }
        Insert: {
          aduana?: string | null
          cantidad?: string | null
          clave?: string | null
          clave_insumo?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          factura?: string | null
          fecha_factura?: string | null
          fecha_pago?: string | null
          fecha_presentacion?: string | null
          fraccion?: string | null
          id?: number
          incoterm?: string | null
          numero_parte?: string | null
          pais_origen?: string | null
          pedimento: string
          peso_kg?: string | null
          proveedor?: string | null
          short_pedimento?: string | null
          tax_id?: string | null
          tenant_id: string
          tipo_cambio?: string | null
          tratado?: string | null
          um_comercial?: string | null
          valor_dolar?: string | null
        }
        Update: {
          aduana?: string | null
          cantidad?: string | null
          clave?: string | null
          clave_insumo?: string | null
          client_id?: string | null
          company_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          factura?: string | null
          fecha_factura?: string | null
          fecha_pago?: string | null
          fecha_presentacion?: string | null
          fraccion?: string | null
          id?: number
          incoterm?: string | null
          numero_parte?: string | null
          pais_origen?: string | null
          pedimento?: string
          peso_kg?: string | null
          proveedor?: string | null
          short_pedimento?: string | null
          tax_id?: string | null
          tenant_id?: string
          tipo_cambio?: string | null
          tratado?: string | null
          um_comercial?: string | null
          valor_dolar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anexo24_partidas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      anexo24_pedimentos: {
        Row: {
          aduana: string | null
          company_id: string | null
          created_at: string | null
          fecha_pago: string | null
          fecha_presentacion: string | null
          fracciones: string | null
          id: number
          num_partidas: number | null
          paises: string | null
          pedimento: string
          proveedores: string | null
          short_pedimento: string | null
          tenant_id: string
          tipo_cambio: string | null
          total_valor_dolar: number | null
        }
        Insert: {
          aduana?: string | null
          company_id?: string | null
          created_at?: string | null
          fecha_pago?: string | null
          fecha_presentacion?: string | null
          fracciones?: string | null
          id?: number
          num_partidas?: number | null
          paises?: string | null
          pedimento: string
          proveedores?: string | null
          short_pedimento?: string | null
          tenant_id: string
          tipo_cambio?: string | null
          total_valor_dolar?: number | null
        }
        Update: {
          aduana?: string | null
          company_id?: string | null
          created_at?: string | null
          fecha_pago?: string | null
          fecha_presentacion?: string | null
          fracciones?: string | null
          id?: number
          num_partidas?: number | null
          paises?: string | null
          pedimento?: string
          proveedores?: string | null
          short_pedimento?: string | null
          tenant_id?: string
          tipo_cambio?: string | null
          total_valor_dolar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anexo24_pedimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      anexo24_proveedores: {
        Row: {
          company_id: string | null
          created_at: string | null
          fracciones_usadas: string | null
          id: number
          incoterms: string | null
          num_facturas: number | null
          num_partidas: number | null
          ofac_last_checked: string | null
          ofac_match_score: number | null
          ofac_status: string | null
          pais: string | null
          partes_unicas: string | null
          proveedor: string
          tax_id: string | null
          total_usd: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          fracciones_usadas?: string | null
          id?: number
          incoterms?: string | null
          num_facturas?: number | null
          num_partidas?: number | null
          ofac_last_checked?: string | null
          ofac_match_score?: number | null
          ofac_status?: string | null
          pais?: string | null
          partes_unicas?: string | null
          proveedor: string
          tax_id?: string | null
          total_usd?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          fracciones_usadas?: string | null
          id?: number
          incoterms?: string | null
          num_facturas?: number | null
          num_partidas?: number | null
          ofac_last_checked?: string | null
          ofac_match_score?: number | null
          ofac_status?: string | null
          pais?: string | null
          partes_unicas?: string | null
          proveedor?: string
          tax_id?: string | null
          total_usd?: number | null
        }
        Relationships: []
      }
      anomaly_baselines: {
        Row: {
          baseline_key: string | null
          baseline_type: string | null
          calculated_at: string | null
          company_id: string | null
          entity_key: string | null
          id: string
          max_value: number | null
          mean_value: number | null
          min_value: number | null
          sample_count: number | null
          std_value: number | null
          threshold_high: number | null
          threshold_low: number | null
        }
        Insert: {
          baseline_key?: string | null
          baseline_type?: string | null
          calculated_at?: string | null
          company_id?: string | null
          entity_key?: string | null
          id?: string
          max_value?: number | null
          mean_value?: number | null
          min_value?: number | null
          sample_count?: number | null
          std_value?: number | null
          threshold_high?: number | null
          threshold_low?: number | null
        }
        Update: {
          baseline_key?: string | null
          baseline_type?: string | null
          calculated_at?: string | null
          company_id?: string | null
          entity_key?: string | null
          id?: string
          max_value?: number | null
          mean_value?: number | null
          min_value?: number | null
          sample_count?: number | null
          std_value?: number | null
          threshold_high?: number | null
          threshold_low?: number | null
        }
        Relationships: []
      }
      anomaly_log: {
        Row: {
          check_date: string
          client: string
          created_at: string | null
          current_value: number | null
          delta_pct: number | null
          id: number
          metric: string
          previous_value: number | null
          severity: string | null
        }
        Insert: {
          check_date: string
          client: string
          created_at?: string | null
          current_value?: number | null
          delta_pct?: number | null
          id?: number
          metric: string
          previous_value?: number | null
          severity?: string | null
        }
        Update: {
          check_date?: string
          client?: string
          created_at?: string | null
          current_value?: number | null
          delta_pct?: number | null
          id?: number
          metric?: string
          previous_value?: number | null
          severity?: string | null
        }
        Relationships: []
      }
      api_cost_log: {
        Row: {
          action: string | null
          client_code: string | null
          cost_usd: number | null
          created_at: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
        }
        Insert: {
          action?: string | null
          client_code?: string | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
        }
        Update: {
          action?: string | null
          client_code?: string | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          key_hash: string | null
          key_prefix: string | null
          last_used: string | null
          name: string | null
          permissions: string[] | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          key_hash?: string | null
          key_prefix?: string | null
          last_used?: string | null
          name?: string | null
          permissions?: string[] | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          key_hash?: string | null
          key_prefix?: string | null
          last_used?: string | null
          name?: string | null
          permissions?: string[] | null
        }
        Relationships: []
      }
      approval_log: {
        Row: {
          action: string | null
          approved_at: string | null
          approved_by: string | null
          chat_id: string | null
          id: string
          trafico_id: string | null
        }
        Insert: {
          action?: string | null
          approved_at?: string | null
          approved_by?: string | null
          chat_id?: string | null
          id?: string
          trafico_id?: string | null
        }
        Update: {
          action?: string | null
          approved_at?: string | null
          approved_by?: string | null
          chat_id?: string | null
          id?: string
          trafico_id?: string | null
        }
        Relationships: []
      }
      approved_suppliers: {
        Row: {
          approved_date: string | null
          company_id: string | null
          country: string | null
          created_at: string | null
          id: string
          notes: string | null
          proveedor: string | null
          usmca_eligible: boolean | null
        }
        Insert: {
          approved_date?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          proveedor?: string | null
          usmca_eligible?: boolean | null
        }
        Update: {
          approved_date?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          proveedor?: string | null
          usmca_eligible?: boolean | null
        }
        Relationships: []
      }
      assumption_audit: {
        Row: {
          assumption: string
          category: string | null
          checked_at: string | null
          evidence_against: Json | null
          evidence_for: Json | null
          id: number
          recommendation: string | null
          still_valid: boolean | null
        }
        Insert: {
          assumption: string
          category?: string | null
          checked_at?: string | null
          evidence_against?: Json | null
          evidence_for?: Json | null
          id?: number
          recommendation?: string | null
          still_valid?: boolean | null
        }
        Update: {
          assumption?: string
          category?: string | null
          checked_at?: string | null
          evidence_against?: Json | null
          evidence_for?: Json | null
          id?: number
          recommendation?: string | null
          still_valid?: boolean | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          diff: Json | null
          id: number
          ip: string | null
          resource: string | null
          resource_id: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          diff?: Json | null
          id?: number
          ip?: string | null
          resource?: string | null
          resource_id?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          diff?: Json | null
          id?: number
          ip?: string | null
          resource?: string | null
          resource_id?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      autonomy_config: {
        Row: {
          accuracy_30d: number | null
          action_type: string
          consecutive_correct: number | null
          current_level: number
          errors_7d: number | null
          last_demotion: string | null
          last_promotion: string | null
          total_actions: number | null
          updated_at: string | null
        }
        Insert: {
          accuracy_30d?: number | null
          action_type: string
          consecutive_correct?: number | null
          current_level?: number
          errors_7d?: number | null
          last_demotion?: string | null
          last_promotion?: string | null
          total_actions?: number | null
          updated_at?: string | null
        }
        Update: {
          accuracy_30d?: number | null
          action_type?: string
          consecutive_correct?: number | null
          current_level?: number
          errors_7d?: number | null
          last_demotion?: string | null
          last_promotion?: string | null
          total_actions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      benchmarks: {
        Row: {
          computed_at: string | null
          dimension: string | null
          id: number
          metric: string
          period: string | null
          sample_size: number | null
          value: number | null
        }
        Insert: {
          computed_at?: string | null
          dimension?: string | null
          id?: number
          metric: string
          period?: string | null
          sample_size?: number | null
          value?: number | null
        }
        Update: {
          computed_at?: string | null
          dimension?: string | null
          id?: number
          metric?: string
          period?: string | null
          sample_size?: number | null
          value?: number | null
        }
        Relationships: []
      }
      bodega_entradas: {
        Row: {
          bultos_esperados: number | null
          bultos_recibidos: number | null
          company_id: string | null
          created_at: string | null
          descripcion: string | null
          estado: string | null
          fecha_entrada: string | null
          id: string
          notas: string | null
          pedimento: string | null
          peso_esperado_kg: number | null
          peso_recibido_kg: number | null
          proveedor: string | null
          recibido_por: string | null
          trafico: string | null
          ubicacion_bodega: string | null
          updated_at: string | null
        }
        Insert: {
          bultos_esperados?: number | null
          bultos_recibidos?: number | null
          company_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_entrada?: string | null
          id?: string
          notas?: string | null
          pedimento?: string | null
          peso_esperado_kg?: number | null
          peso_recibido_kg?: number | null
          proveedor?: string | null
          recibido_por?: string | null
          trafico?: string | null
          ubicacion_bodega?: string | null
          updated_at?: string | null
        }
        Update: {
          bultos_esperados?: number | null
          bultos_recibidos?: number | null
          company_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_entrada?: string | null
          id?: string
          notas?: string | null
          pedimento?: string | null
          peso_esperado_kg?: number | null
          peso_recibido_kg?: number | null
          proveedor?: string | null
          recibido_por?: string | null
          trafico?: string | null
          ubicacion_bodega?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bridge_intelligence: {
        Row: {
          bridge_id: string | null
          bridge_name: string | null
          calculated_at: string | null
          carrier: string | null
          company_id: string | null
          crossing_date: string | null
          crossing_hours: number | null
          day_of_week: number | null
          fecha_cruce: string | null
          hour_of_day: number | null
          id: string
          product_category: string | null
          semaforo: string | null
          trafico_id: string | null
        }
        Insert: {
          bridge_id?: string | null
          bridge_name?: string | null
          calculated_at?: string | null
          carrier?: string | null
          company_id?: string | null
          crossing_date?: string | null
          crossing_hours?: number | null
          day_of_week?: number | null
          fecha_cruce?: string | null
          hour_of_day?: number | null
          id?: string
          product_category?: string | null
          semaforo?: string | null
          trafico_id?: string | null
        }
        Update: {
          bridge_id?: string | null
          bridge_name?: string | null
          calculated_at?: string | null
          carrier?: string | null
          company_id?: string | null
          crossing_date?: string | null
          crossing_hours?: number | null
          day_of_week?: number | null
          fecha_cruce?: string | null
          hour_of_day?: number | null
          id?: string
          product_category?: string | null
          semaforo?: string | null
          trafico_id?: string | null
        }
        Relationships: []
      }
      bridge_times: {
        Row: {
          bridge_code: string
          bridge_name: string
          direction: string | null
          id: string
          recorded_at: string | null
          semaforo: string | null
          source: string | null
          wait_minutes: number | null
        }
        Insert: {
          bridge_code: string
          bridge_name: string
          direction?: string | null
          id?: string
          recorded_at?: string | null
          semaforo?: string | null
          source?: string | null
          wait_minutes?: number | null
        }
        Update: {
          bridge_code?: string
          bridge_name?: string
          direction?: string | null
          id?: string
          recorded_at?: string | null
          semaforo?: string | null
          source?: string | null
          wait_minutes?: number | null
        }
        Relationships: []
      }
      bridge_wait_times: {
        Row: {
          bridge_name: string | null
          id: string
          lanes_open: number | null
          port_number: string | null
          recorded_at: string | null
          source: string | null
          wait_time_commercial: number | null
          wait_time_passenger: number | null
        }
        Insert: {
          bridge_name?: string | null
          id?: string
          lanes_open?: number | null
          port_number?: string | null
          recorded_at?: string | null
          source?: string | null
          wait_time_commercial?: number | null
          wait_time_passenger?: number | null
        }
        Update: {
          bridge_name?: string | null
          id?: string
          lanes_open?: number | null
          port_number?: string | null
          recorded_at?: string | null
          source?: string | null
          wait_time_commercial?: number | null
          wait_time_passenger?: number | null
        }
        Relationships: []
      }
      call_transcripts: {
        Row: {
          action_items: Json | null
          company_id: string | null
          duration_seconds: number | null
          filename: string | null
          follow_up_email: string | null
          full_transcript: string | null
          id: string
          language: string | null
          summary: string | null
          traficos_mentioned: string[] | null
          transcribed_at: string | null
        }
        Insert: {
          action_items?: Json | null
          company_id?: string | null
          duration_seconds?: number | null
          filename?: string | null
          follow_up_email?: string | null
          full_transcript?: string | null
          id?: string
          language?: string | null
          summary?: string | null
          traficos_mentioned?: string[] | null
          transcribed_at?: string | null
        }
        Update: {
          action_items?: Json | null
          company_id?: string | null
          duration_seconds?: number | null
          filename?: string | null
          follow_up_email?: string | null
          full_transcript?: string | null
          id?: string
          language?: string | null
          summary?: string | null
          traficos_mentioned?: string[] | null
          transcribed_at?: string | null
        }
        Relationships: []
      }
      catalogo_master: {
        Row: {
          clave_sat: string | null
          clave_sat_fuente: string | null
          client_id: string | null
          company_id: string | null
          confianza: string | null
          created_at: string | null
          descripcion: string | null
          descripcion_sat: string | null
          fraccion: string | null
          id: number
          numero_parte: string
          pais_origen: string | null
          proveedor: string | null
          riesgo: string | null
          unidad_sat: string | null
          updated_at: string | null
        }
        Insert: {
          clave_sat?: string | null
          clave_sat_fuente?: string | null
          client_id?: string | null
          company_id?: string | null
          confianza?: string | null
          created_at?: string | null
          descripcion?: string | null
          descripcion_sat?: string | null
          fraccion?: string | null
          id?: number
          numero_parte: string
          pais_origen?: string | null
          proveedor?: string | null
          riesgo?: string | null
          unidad_sat?: string | null
          updated_at?: string | null
        }
        Update: {
          clave_sat?: string | null
          clave_sat_fuente?: string | null
          client_id?: string | null
          company_id?: string | null
          confianza?: string | null
          created_at?: string | null
          descripcion?: string | null
          descripcion_sat?: string | null
          fraccion?: string | null
          id?: number
          numero_parte?: string
          pais_origen?: string | null
          proveedor?: string | null
          riesgo?: string | null
          unidad_sat?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      caza_contact_log: {
        Row: {
          actor: string
          channel: string
          created_at: string | null
          direction: string
          id: string
          next_step: string | null
          outcome: string | null
          pipeline_id: string | null
          rfc: string
          summary: string
        }
        Insert: {
          actor?: string
          channel: string
          created_at?: string | null
          direction: string
          id?: string
          next_step?: string | null
          outcome?: string | null
          pipeline_id?: string | null
          rfc: string
          summary: string
        }
        Update: {
          actor?: string
          channel?: string
          created_at?: string | null
          direction?: string
          id?: string
          next_step?: string | null
          outcome?: string | null
          pipeline_id?: string | null
          rfc?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "caza_contact_log_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "caza_ghost_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caza_contact_log_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "caza_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      caza_market_intel: {
        Row: {
          aduana: string
          fecha_pago: string | null
          fraccion_principal: string | null
          id: string
          num_entradas: number | null
          patente: string
          pedimento_num: string | null
          razon_social: string | null
          rfc_importador: string
          source: string | null
          source_month: number | null
          source_year: number | null
          synced_at: string | null
          valor_usd: number | null
        }
        Insert: {
          aduana?: string
          fecha_pago?: string | null
          fraccion_principal?: string | null
          id?: string
          num_entradas?: number | null
          patente: string
          pedimento_num?: string | null
          razon_social?: string | null
          rfc_importador: string
          source?: string | null
          source_month?: number | null
          source_year?: number | null
          synced_at?: string | null
          valor_usd?: number | null
        }
        Update: {
          aduana?: string
          fecha_pago?: string | null
          fraccion_principal?: string | null
          id?: string
          num_entradas?: number | null
          patente?: string
          pedimento_num?: string | null
          razon_social?: string | null
          rfc_importador?: string
          source?: string | null
          source_month?: number | null
          source_year?: number | null
          synced_at?: string | null
          valor_usd?: number | null
        }
        Relationships: []
      }
      caza_pipeline: {
        Row: {
          avg_crossings_per_month: number | null
          avg_monthly_value_usd: number | null
          caza_score: number | null
          created_at: string | null
          current_patente: string | null
          id: string
          last_crossing_240: string | null
          last_op_with_us: string | null
          lost_reason: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          owner: string
          razon_social: string
          rfc: string
          source: string
          stage: string
          total_ops_with_us: number | null
          updated_at: string | null
        }
        Insert: {
          avg_crossings_per_month?: number | null
          avg_monthly_value_usd?: number | null
          caza_score?: number | null
          created_at?: string | null
          current_patente?: string | null
          id?: string
          last_crossing_240?: string | null
          last_op_with_us?: string | null
          lost_reason?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          owner?: string
          razon_social: string
          rfc: string
          source?: string
          stage?: string
          total_ops_with_us?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_crossings_per_month?: number | null
          avg_monthly_value_usd?: number | null
          caza_score?: number | null
          created_at?: string | null
          current_patente?: string | null
          id?: string
          last_crossing_240?: string | null
          last_op_with_us?: string | null
          lost_reason?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          owner?: string
          razon_social?: string
          rfc?: string
          source?: string
          stage?: string
          total_ops_with_us?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      classification_feedback: {
        Row: {
          audit_outcome: string | null
          corrected_by: string | null
          created_at: string | null
          fraccion_final: string | null
          fraccion_suggested: string | null
          id: string
          invoice_description: string | null
        }
        Insert: {
          audit_outcome?: string | null
          corrected_by?: string | null
          created_at?: string | null
          fraccion_final?: string | null
          fraccion_suggested?: string | null
          id?: string
          invoice_description?: string | null
        }
        Update: {
          audit_outcome?: string | null
          corrected_by?: string | null
          created_at?: string | null
          fraccion_final?: string | null
          fraccion_suggested?: string | null
          id?: string
          invoice_description?: string | null
        }
        Relationships: []
      }
      classification_log: {
        Row: {
          clave_insumo: string | null
          client_id: string | null
          fraccion_assigned: string | null
          id: string
          numero_parte: string | null
          prompt_version: string | null
          supertito_agreed: boolean | null
          supertito_correction: string | null
          think_confidence: number | null
          ts: string | null
        }
        Insert: {
          clave_insumo?: string | null
          client_id?: string | null
          fraccion_assigned?: string | null
          id?: string
          numero_parte?: string | null
          prompt_version?: string | null
          supertito_agreed?: boolean | null
          supertito_correction?: string | null
          think_confidence?: number | null
          ts?: string | null
        }
        Update: {
          clave_insumo?: string | null
          client_id?: string | null
          fraccion_assigned?: string | null
          id?: string
          numero_parte?: string | null
          prompt_version?: string | null
          supertito_agreed?: boolean | null
          supertito_correction?: string | null
          think_confidence?: number | null
          ts?: string | null
        }
        Relationships: []
      }
      classifier_training_log: {
        Row: {
          accepted: boolean | null
          attempts: number | null
          chapter_hint: string | null
          confidence_final: number | null
          created_at: string | null
          descripcion: string | null
          flagged_human: boolean | null
          fraccion_correct: string | null
          fraccion_predicted: string | null
          id: string
          subpos_hint: string | null
        }
        Insert: {
          accepted?: boolean | null
          attempts?: number | null
          chapter_hint?: string | null
          confidence_final?: number | null
          created_at?: string | null
          descripcion?: string | null
          flagged_human?: boolean | null
          fraccion_correct?: string | null
          fraccion_predicted?: string | null
          id?: string
          subpos_hint?: string | null
        }
        Update: {
          accepted?: boolean | null
          attempts?: number | null
          chapter_hint?: string | null
          confidence_final?: number | null
          created_at?: string | null
          descripcion?: string | null
          flagged_human?: boolean | null
          fraccion_correct?: string | null
          fraccion_predicted?: string | null
          id?: string
          subpos_hint?: string | null
        }
        Relationships: []
      }
      clearance_sandbox_results: {
        Row: {
          actual_dta: number | null
          actual_fraccion: string | null
          actual_igi: number | null
          actual_iva: number | null
          actual_tipo_cambio: number | null
          actual_tmec: boolean | null
          actual_total: number | null
          actual_valor_usd: number | null
          ai_cost_usd: number | null
          company_id: string
          created_at: string | null
          failure_reasons: string[] | null
          field_scores: Json
          ghost_dta: number | null
          ghost_fraccion: string | null
          ghost_igi: number | null
          ghost_iva: number | null
          ghost_tipo_cambio: number | null
          ghost_tmec: boolean | null
          ghost_total: number | null
          ghost_valor_usd: number | null
          id: string
          incomplete_fields: string[] | null
          latency_ms: number | null
          mode: string | null
          overall_score: number
          pass: boolean
          referencia: string
          run_id: string
          tokens_used: number | null
        }
        Insert: {
          actual_dta?: number | null
          actual_fraccion?: string | null
          actual_igi?: number | null
          actual_iva?: number | null
          actual_tipo_cambio?: number | null
          actual_tmec?: boolean | null
          actual_total?: number | null
          actual_valor_usd?: number | null
          ai_cost_usd?: number | null
          company_id: string
          created_at?: string | null
          failure_reasons?: string[] | null
          field_scores?: Json
          ghost_dta?: number | null
          ghost_fraccion?: string | null
          ghost_igi?: number | null
          ghost_iva?: number | null
          ghost_tipo_cambio?: number | null
          ghost_tmec?: boolean | null
          ghost_total?: number | null
          ghost_valor_usd?: number | null
          id?: string
          incomplete_fields?: string[] | null
          latency_ms?: number | null
          mode?: string | null
          overall_score?: number
          pass?: boolean
          referencia: string
          run_id: string
          tokens_used?: number | null
        }
        Update: {
          actual_dta?: number | null
          actual_fraccion?: string | null
          actual_igi?: number | null
          actual_iva?: number | null
          actual_tipo_cambio?: number | null
          actual_tmec?: boolean | null
          actual_total?: number | null
          actual_valor_usd?: number | null
          ai_cost_usd?: number | null
          company_id?: string
          created_at?: string | null
          failure_reasons?: string[] | null
          field_scores?: Json
          ghost_dta?: number | null
          ghost_fraccion?: string | null
          ghost_igi?: number | null
          ghost_iva?: number | null
          ghost_tipo_cambio?: number | null
          ghost_tmec?: boolean | null
          ghost_total?: number | null
          ghost_valor_usd?: number | null
          id?: string
          incomplete_fields?: string[] | null
          latency_ms?: number | null
          mode?: string | null
          overall_score?: number
          pass?: boolean
          referencia?: string
          run_id?: string
          tokens_used?: number | null
        }
        Relationships: []
      }
      client_benchmarks: {
        Row: {
          bottom_quartile: number | null
          calculated_at: string | null
          client_value: number | null
          company_id: string | null
          fleet_average: number | null
          fleet_median: number | null
          id: string
          industry_avg: number | null
          is_baseline: boolean | null
          metric_name: string | null
          metrics: Json | null
          percentile: number | null
          period: string | null
          sample_size: number | null
          top_quartile: number | null
          total_operations: number | null
          total_value_usd: number | null
        }
        Insert: {
          bottom_quartile?: number | null
          calculated_at?: string | null
          client_value?: number | null
          company_id?: string | null
          fleet_average?: number | null
          fleet_median?: number | null
          id?: string
          industry_avg?: number | null
          is_baseline?: boolean | null
          metric_name?: string | null
          metrics?: Json | null
          percentile?: number | null
          period?: string | null
          sample_size?: number | null
          top_quartile?: number | null
          total_operations?: number | null
          total_value_usd?: number | null
        }
        Update: {
          bottom_quartile?: number | null
          calculated_at?: string | null
          client_value?: number | null
          company_id?: string | null
          fleet_average?: number | null
          fleet_median?: number | null
          id?: string
          industry_avg?: number | null
          is_baseline?: boolean | null
          metric_name?: string | null
          metrics?: Json | null
          percentile?: number | null
          period?: string | null
          sample_size?: number | null
          top_quartile?: number | null
          total_operations?: number | null
          total_value_usd?: number | null
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string | null
          document_type_id: number
          expiration_date: string | null
          file_name: string | null
          file_url: string | null
          id: number
          notes: string | null
          period: string | null
          status: string
          upload_date: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id?: string
          created_at?: string | null
          document_type_id: number
          expiration_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: number
          notes?: string | null
          period?: string | null
          status?: string
          upload_date?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          document_type_id?: number
          expiration_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: number
          notes?: string | null
          period?: string | null
          status?: string
          upload_date?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notification_prefs: {
        Row: {
          cc_emails: string[] | null
          client_code: string
          created_at: string | null
          id: string
          language: string | null
          notify_cleared: boolean | null
          notify_delivered: boolean | null
          notify_dispatched: boolean | null
          notify_doc_reminders: boolean | null
          notify_docs_complete: boolean | null
          notify_entrada_created: boolean | null
          notify_hold: boolean | null
          notify_pedimento_filed: boolean | null
          primary_channel: string | null
          primary_email: string | null
        }
        Insert: {
          cc_emails?: string[] | null
          client_code: string
          created_at?: string | null
          id?: string
          language?: string | null
          notify_cleared?: boolean | null
          notify_delivered?: boolean | null
          notify_dispatched?: boolean | null
          notify_doc_reminders?: boolean | null
          notify_docs_complete?: boolean | null
          notify_entrada_created?: boolean | null
          notify_hold?: boolean | null
          notify_pedimento_filed?: boolean | null
          primary_channel?: string | null
          primary_email?: string | null
        }
        Update: {
          cc_emails?: string[] | null
          client_code?: string
          created_at?: string | null
          id?: string
          language?: string | null
          notify_cleared?: boolean | null
          notify_delivered?: boolean | null
          notify_dispatched?: boolean | null
          notify_doc_reminders?: boolean | null
          notify_docs_complete?: boolean | null
          notify_entrada_created?: boolean | null
          notify_hold?: boolean | null
          notify_pedimento_filed?: boolean | null
          primary_channel?: string | null
          primary_email?: string | null
        }
        Relationships: []
      }
      client_onboarding: {
        Row: {
          company_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          status: string | null
          step: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          step?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          step?: string | null
        }
        Relationships: []
      }
      client_profiles: {
        Row: {
          churn_risk: string | null
          company_id: string
          profile_data: Json
          updated_at: string | null
        }
        Insert: {
          churn_risk?: string | null
          company_id: string
          profile_data: Json
          updated_at?: string | null
        }
        Update: {
          churn_risk?: string | null
          company_id?: string
          profile_data?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      client_readiness: {
        Row: {
          breakdown: Json | null
          company_id: string
          ready: boolean | null
          score: number
          scored_at: string | null
        }
        Insert: {
          breakdown?: Json | null
          company_id: string
          ready?: boolean | null
          score?: number
          scored_at?: string | null
        }
        Update: {
          breakdown?: Json | null
          company_id?: string
          ready?: boolean | null
          score?: number
          scored_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          broker_side: string | null
          company_name: string
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          phone: string | null
        }
        Insert: {
          broker_side?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
        }
        Update: {
          broker_side?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      communication_events: {
        Row: {
          date: string | null
          email_id: string | null
          from_address: string | null
          id: string
          is_urgent: boolean | null
          pedimentos_mentioned: string[] | null
          scanned_at: string | null
          subject: string | null
          tenant_slug: string | null
          traficos_mentioned: string[] | null
          urgent_keywords: string[] | null
        }
        Insert: {
          date?: string | null
          email_id?: string | null
          from_address?: string | null
          id?: string
          is_urgent?: boolean | null
          pedimentos_mentioned?: string[] | null
          scanned_at?: string | null
          subject?: string | null
          tenant_slug?: string | null
          traficos_mentioned?: string[] | null
          urgent_keywords?: string[] | null
        }
        Update: {
          date?: string | null
          email_id?: string | null
          from_address?: string | null
          id?: string
          is_urgent?: boolean | null
          pedimentos_mentioned?: string[] | null
          scanned_at?: string | null
          subject?: string | null
          tenant_slug?: string | null
          traficos_mentioned?: string[] | null
          urgent_keywords?: string[] | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean | null
          aduana: string | null
          clave_cliente: string | null
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          first_login_at: string | null
          first_question_at: string | null
          globalpc_clave: string | null
          health_breakdown: Json | null
          health_details: Json | null
          health_grade: string | null
          health_score: number | null
          health_score_updated: string | null
          id: string
          immex: boolean | null
          language: string | null
          last_sync: string | null
          name: string
          onboarded_at: string | null
          patente: string | null
          portal_password: string | null
          portal_url: string | null
          rfc: string | null
          tmec_eligible: boolean | null
          traficos_count: number | null
        }
        Insert: {
          active?: boolean | null
          aduana?: string | null
          clave_cliente?: string | null
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          first_login_at?: string | null
          first_question_at?: string | null
          globalpc_clave?: string | null
          health_breakdown?: Json | null
          health_details?: Json | null
          health_grade?: string | null
          health_score?: number | null
          health_score_updated?: string | null
          id?: string
          immex?: boolean | null
          language?: string | null
          last_sync?: string | null
          name: string
          onboarded_at?: string | null
          patente?: string | null
          portal_password?: string | null
          portal_url?: string | null
          rfc?: string | null
          tmec_eligible?: boolean | null
          traficos_count?: number | null
        }
        Update: {
          active?: boolean | null
          aduana?: string | null
          clave_cliente?: string | null
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          first_login_at?: string | null
          first_question_at?: string | null
          globalpc_clave?: string | null
          health_breakdown?: Json | null
          health_details?: Json | null
          health_grade?: string | null
          health_score?: number | null
          health_score_updated?: string | null
          id?: string
          immex?: boolean | null
          language?: string | null
          last_sync?: string | null
          name?: string
          onboarded_at?: string | null
          patente?: string | null
          portal_password?: string | null
          portal_url?: string | null
          rfc?: string | null
          tmec_eligible?: boolean | null
          traficos_count?: number | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          category: string
          company_id: string
          created_at: string | null
          description: string | null
          document_name: string
          document_type: string
          expires_at: string | null
          file_url: string | null
          id: string
          is_monthly: boolean | null
          month_year: string | null
          required: boolean | null
          status: string
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          document_name: string
          document_type: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          is_monthly?: boolean | null
          month_year?: string | null
          required?: boolean | null
          status?: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          document_name?: string
          document_type?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          is_monthly?: boolean | null
          month_year?: string | null
          required?: boolean | null
          status?: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      compliance_calendar: {
        Row: {
          action_url: string | null
          company_id: string | null
          created_at: string | null
          deadline_date: string | null
          deadline_type: string | null
          description: string | null
          id: string
          penalty_description: string | null
          penalty_max_mxn: number | null
          penalty_min_mxn: number | null
          resolved_at: string | null
          responsible_person: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          action_url?: string | null
          company_id?: string | null
          created_at?: string | null
          deadline_date?: string | null
          deadline_type?: string | null
          description?: string | null
          id?: string
          penalty_description?: string | null
          penalty_max_mxn?: number | null
          penalty_min_mxn?: number | null
          resolved_at?: string | null
          responsible_person?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          action_url?: string | null
          company_id?: string | null
          created_at?: string | null
          deadline_date?: string | null
          deadline_type?: string | null
          description?: string | null
          id?: string
          penalty_description?: string | null
          penalty_max_mxn?: number | null
          penalty_min_mxn?: number | null
          resolved_at?: string | null
          responsible_person?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
      compliance_events: {
        Row: {
          company_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          event_type: string | null
          id: string
          severity: string | null
          telegram_reminder: boolean | null
          title: string
        }
        Insert: {
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          event_type?: string | null
          id?: string
          severity?: string | null
          telegram_reminder?: boolean | null
          title: string
        }
        Update: {
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          event_type?: string | null
          id?: string
          severity?: string | null
          telegram_reminder?: boolean | null
          title?: string
        }
        Relationships: []
      }
      compliance_predictions: {
        Row: {
          calculated_at: string | null
          company_id: string | null
          created_at: string | null
          days_until: number | null
          description: string | null
          due_date: string | null
          id: string
          prediction_type: string | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string | null
          title: string | null
          trafico_id: string | null
        }
        Insert: {
          calculated_at?: string | null
          company_id?: string | null
          created_at?: string | null
          days_until?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          prediction_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          title?: string | null
          trafico_id?: string | null
        }
        Update: {
          calculated_at?: string | null
          company_id?: string | null
          created_at?: string | null
          days_until?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          prediction_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          title?: string | null
          trafico_id?: string | null
        }
        Relationships: []
      }
      compliance_risk_scores: {
        Row: {
          audit_probability: number
          company_id: string
          id: number
          quarter: string
          recommended_actions: Json | null
          risk_factors: Json
          risk_level: string
          scored_at: string | null
        }
        Insert: {
          audit_probability: number
          company_id: string
          id?: number
          quarter: string
          recommended_actions?: Json | null
          risk_factors: Json
          risk_level: string
          scored_at?: string | null
        }
        Update: {
          audit_probability?: number
          company_id?: string
          id?: number
          quarter?: string
          recommended_actions?: Json | null
          risk_factors?: Json
          risk_level?: string
          scored_at?: string | null
        }
        Relationships: []
      }
      compliance_scores: {
        Row: {
          anexo24_score: number | null
          audit_avg_confidence: number | null
          audit_category_breakdown: Json | null
          audit_correct: number | null
          audit_date: string | null
          audit_run_id: string | null
          audit_top_errors: Json | null
          audit_total: number | null
          classification_accuracy_score: number | null
          composite_score: number | null
          docs_score: number | null
          id: number
          pedimentos_score: number | null
          score_weights: Json
          scored_at: string
        }
        Insert: {
          anexo24_score?: number | null
          audit_avg_confidence?: number | null
          audit_category_breakdown?: Json | null
          audit_correct?: number | null
          audit_date?: string | null
          audit_run_id?: string | null
          audit_top_errors?: Json | null
          audit_total?: number | null
          classification_accuracy_score?: number | null
          composite_score?: number | null
          docs_score?: number | null
          id?: number
          pedimentos_score?: number | null
          score_weights?: Json
          scored_at?: string
        }
        Update: {
          anexo24_score?: number | null
          audit_avg_confidence?: number | null
          audit_category_breakdown?: Json | null
          audit_correct?: number | null
          audit_date?: string | null
          audit_run_id?: string | null
          audit_top_errors?: Json | null
          audit_total?: number | null
          classification_accuracy_score?: number | null
          composite_score?: number | null
          docs_score?: number | null
          id?: number
          pedimentos_score?: number | null
          score_weights?: Json
          scored_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          ai_response: string | null
          channel: string | null
          client_id: string | null
          content: string | null
          created_at: string | null
          direction: string | null
          duration: number | null
          id: string
          phone_number: string | null
          shipment_id: string | null
        }
        Insert: {
          ai_response?: string | null
          channel?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string | null
          duration?: number | null
          id?: string
          phone_number?: string | null
          shipment_id?: string | null
        }
        Update: {
          ai_response?: string | null
          channel?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string | null
          duration?: number | null
          id?: string
          phone_number?: string | null
          shipment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      corrections: {
        Row: {
          context: Json | null
          corrected_by: string | null
          corrected_output: Json | null
          created_at: string | null
          id: string
          module_name: string
          original_output: Json | null
        }
        Insert: {
          context?: Json | null
          corrected_by?: string | null
          corrected_output?: Json | null
          created_at?: string | null
          id?: string
          module_name: string
          original_output?: Json | null
        }
        Update: {
          context?: Json | null
          corrected_by?: string | null
          corrected_output?: Json | null
          created_at?: string | null
          id?: string
          module_name?: string
          original_output?: Json | null
        }
        Relationships: []
      }
      coves: {
        Row: {
          anexo24_pedimento_id: number | null
          ciudad: string | null
          company_id: string | null
          cove_numero: string | null
          created_at: string | null
          cve_proveedor: string | null
          domicilio: string | null
          factura: string | null
          fecha: string | null
          id: number
          id_proveedor: string | null
          incoterm: string | null
          moneda: string | null
          pais: string | null
          pedimento: string | null
          proveedor: string | null
          trafico: string | null
          val_dolares: number | null
          val_moneda: number | null
          vinculacion: string | null
        }
        Insert: {
          anexo24_pedimento_id?: number | null
          ciudad?: string | null
          company_id?: string | null
          cove_numero?: string | null
          created_at?: string | null
          cve_proveedor?: string | null
          domicilio?: string | null
          factura?: string | null
          fecha?: string | null
          id?: number
          id_proveedor?: string | null
          incoterm?: string | null
          moneda?: string | null
          pais?: string | null
          pedimento?: string | null
          proveedor?: string | null
          trafico?: string | null
          val_dolares?: number | null
          val_moneda?: number | null
          vinculacion?: string | null
        }
        Update: {
          anexo24_pedimento_id?: number | null
          ciudad?: string | null
          company_id?: string | null
          cove_numero?: string | null
          created_at?: string | null
          cve_proveedor?: string | null
          domicilio?: string | null
          factura?: string | null
          fecha?: string | null
          id?: number
          id_proveedor?: string | null
          incoterm?: string | null
          moneda?: string | null
          pais?: string | null
          pedimento?: string | null
          proveedor?: string | null
          trafico?: string | null
          val_dolares?: number | null
          val_moneda?: number | null
          vinculacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coves_anexo24_pedimento_id_fkey"
            columns: ["anexo24_pedimento_id"]
            isOneToOne: false
            referencedRelation: "anexo24_pedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      crossing_intelligence: {
        Row: {
          bottleneck_stage: string | null
          company_id: string | null
          created_at: string | null
          had_inspection: boolean | null
          id: string
          red_light_probability: number | null
          semaforo: string | null
          stage_arrival_to_docs: number | null
          stage_docs_to_semaforo: number | null
          stage_semaforo_to_release: number | null
          total_hours: number | null
          trafico_id: string | null
        }
        Insert: {
          bottleneck_stage?: string | null
          company_id?: string | null
          created_at?: string | null
          had_inspection?: boolean | null
          id?: string
          red_light_probability?: number | null
          semaforo?: string | null
          stage_arrival_to_docs?: number | null
          stage_docs_to_semaforo?: number | null
          stage_semaforo_to_release?: number | null
          total_hours?: number | null
          trafico_id?: string | null
        }
        Update: {
          bottleneck_stage?: string | null
          company_id?: string | null
          created_at?: string | null
          had_inspection?: boolean | null
          id?: string
          red_light_probability?: number | null
          semaforo?: string | null
          stage_arrival_to_docs?: number | null
          stage_docs_to_semaforo?: number | null
          stage_semaforo_to_release?: number | null
          total_hours?: number | null
          trafico_id?: string | null
        }
        Relationships: []
      }
      crossing_predictions: {
        Row: {
          accuracy: number | null
          actual_hours: number | null
          calculated_at: string | null
          carrier: string | null
          category: string | null
          company_id: string | null
          confidence: number | null
          data_points: number | null
          factors: Json | null
          id: string
          inspection_probability: number | null
          inspection_risk_factors: Json | null
          predicted_date: string | null
          predicted_hours: number | null
          recommended_bridge: string | null
          recommended_window: string | null
          trafico_id: string
        }
        Insert: {
          accuracy?: number | null
          actual_hours?: number | null
          calculated_at?: string | null
          carrier?: string | null
          category?: string | null
          company_id?: string | null
          confidence?: number | null
          data_points?: number | null
          factors?: Json | null
          id?: string
          inspection_probability?: number | null
          inspection_risk_factors?: Json | null
          predicted_date?: string | null
          predicted_hours?: number | null
          recommended_bridge?: string | null
          recommended_window?: string | null
          trafico_id: string
        }
        Update: {
          accuracy?: number | null
          actual_hours?: number | null
          calculated_at?: string | null
          carrier?: string | null
          category?: string | null
          company_id?: string | null
          confidence?: number | null
          data_points?: number | null
          factors?: Json | null
          id?: string
          inspection_probability?: number | null
          inspection_risk_factors?: Json | null
          predicted_date?: string | null
          predicted_hours?: number | null
          recommended_bridge?: string | null
          recommended_window?: string | null
          trafico_id?: string
        }
        Relationships: []
      }
      crossing_windows: {
        Row: {
          avg_crossing_days: number
          company_id: string
          day_of_week: number
          id: string
          sample_count: number
          updated_at: string
        }
        Insert: {
          avg_crossing_days: number
          company_id: string
          day_of_week: number
          id?: string
          sample_count?: number
          updated_at?: string
        }
        Update: {
          avg_crossing_days?: number
          company_id?: string
          day_of_week?: number
          id?: string
          sample_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      cruz_conversations: {
        Row: {
          company_id: string | null
          created_at: string | null
          cruz_response: string | null
          feedback: string | null
          id: string
          page_context: string | null
          response_time_ms: number | null
          session_id: string | null
          tools_used: string[] | null
          user_message: string | null
          was_helpful: boolean | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          cruz_response?: string | null
          feedback?: string | null
          id?: string
          page_context?: string | null
          response_time_ms?: number | null
          session_id?: string | null
          tools_used?: string[] | null
          user_message?: string | null
          was_helpful?: boolean | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          cruz_response?: string | null
          feedback?: string | null
          id?: string
          page_context?: string | null
          response_time_ms?: number | null
          session_id?: string | null
          tools_used?: string[] | null
          user_message?: string | null
          was_helpful?: boolean | null
        }
        Relationships: []
      }
      cruz_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          processed: boolean | null
          source_module: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          source_module: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          source_module?: string
        }
        Relationships: []
      }
      cruz_memory: {
        Row: {
          company_id: string
          confidence: number | null
          created_at: string | null
          id: number
          last_seen: string | null
          observations: number | null
          pattern_key: string
          pattern_type: string
          pattern_value: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          confidence?: number | null
          created_at?: string | null
          id?: number
          last_seen?: string | null
          observations?: number | null
          pattern_key: string
          pattern_type: string
          pattern_value: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          confidence?: number | null
          created_at?: string | null
          id?: number
          last_seen?: string | null
          observations?: number | null
          pattern_key?: string
          pattern_type?: string
          pattern_value?: string
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          company_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          industry: string | null
          lifetime_value: number | null
          notes: string | null
          phone: string | null
          preferred_language: string | null
          shipments_per_month: number | null
          typical_products: string | null
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          lifetime_value?: number | null
          notes?: string | null
          phone?: string | null
          preferred_language?: string | null
          shipments_per_month?: number | null
          typical_products?: string | null
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          lifetime_value?: number | null
          notes?: string | null
          phone?: string | null
          preferred_language?: string | null
          shipments_per_month?: number | null
          typical_products?: string | null
        }
        Relationships: []
      }
      daily_briefs: {
        Row: {
          brief_data: Json | null
          company_id: string | null
          created_at: string | null
          date: string | null
          id: string
          viewed_at: string | null
        }
        Insert: {
          brief_data?: Json | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          viewed_at?: string | null
        }
        Update: {
          brief_data?: Json | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          client: string | null
          company_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          deadline: string
          id: string
          notes: string | null
          title: string
          type: string
        }
        Insert: {
          client?: string | null
          company_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          deadline: string
          id?: string
          notes?: string | null
          title: string
          type: string
        }
        Update: {
          client?: string | null
          company_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          deadline?: string
          id?: string
          notes?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      decision_log: {
        Row: {
          actual_outcome: string | null
          category: string | null
          client_id: string | null
          context: string | null
          date: string | null
          decision: string
          expected_outcome: string | null
          id: string
          reasoning: string | null
          would_repeat: boolean | null
        }
        Insert: {
          actual_outcome?: string | null
          category?: string | null
          client_id?: string | null
          context?: string | null
          date?: string | null
          decision: string
          expected_outcome?: string | null
          id?: string
          reasoning?: string | null
          would_repeat?: boolean | null
        }
        Update: {
          actual_outcome?: string | null
          category?: string | null
          client_id?: string | null
          context?: string | null
          date?: string | null
          decision?: string
          expected_outcome?: string | null
          id?: string
          reasoning?: string | null
          would_repeat?: boolean | null
        }
        Relationships: []
      }
      demand_forecasts: {
        Row: {
          company_id: string
          created_at: string | null
          forecast_data: Json
          forecast_date: string
          id: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          forecast_data: Json
          forecast_date: string
          id?: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          forecast_data?: Json
          forecast_date?: string
          id?: number
        }
        Relationships: []
      }
      document_classifications: {
        Row: {
          confidence: number | null
          created_at: string | null
          doc_type: string | null
          email_queue_id: string | null
          file_path: string | null
          filename: string | null
          id: string
          invoice_number: string | null
          source: string | null
          supplier: string | null
          value_usd: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          doc_type?: string | null
          email_queue_id?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string
          invoice_number?: string | null
          source?: string | null
          supplier?: string | null
          value_usd?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          doc_type?: string | null
          email_queue_id?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string
          invoice_number?: string | null
          source?: string | null
          supplier?: string | null
          value_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_classifications_email_queue_id_fkey"
            columns: ["email_queue_id"]
            isOneToOne: false
            referencedRelation: "email_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      document_metadata: {
        Row: {
          created_at: string | null
          currency: string | null
          doc_date: string | null
          doc_type: string | null
          document_id: string | null
          extracted_by: string | null
          id: string
          invoice_number: string | null
          raw_extraction: Json | null
          supplier_name: string | null
          total_value: number | null
          trafico_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          doc_date?: string | null
          doc_type?: string | null
          document_id?: string | null
          extracted_by?: string | null
          id?: string
          invoice_number?: string | null
          raw_extraction?: Json | null
          supplier_name?: string | null
          total_value?: number | null
          trafico_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          doc_date?: string | null
          doc_type?: string | null
          document_id?: string | null
          extracted_by?: string | null
          id?: string
          invoice_number?: string | null
          raw_extraction?: Json | null
          supplier_name?: string | null
          total_value?: number | null
          trafico_id?: string | null
        }
        Relationships: []
      }
      document_types: {
        Row: {
          category: string
          code: string
          description: string | null
          frequency: string
          id: number
          immex_only: boolean
          name: string
          required: boolean
          sort_order: number
        }
        Insert: {
          category: string
          code: string
          description?: string | null
          frequency?: string
          id?: number
          immex_only?: boolean
          name: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          category?: string
          code?: string
          description?: string | null
          frequency?: string
          id?: number
          immex_only?: boolean
          name?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      documento_solicitudes: {
        Row: {
          channel: string[] | null
          company_id: string | null
          completed_at: string | null
          created_by: string | null
          deadline: string | null
          doc_type: string
          doc_types: string[] | null
          docs_received: string[] | null
          email_sent_at: string | null
          escalate_after: string | null
          escalated_at: string | null
          id: string
          message: string | null
          recibido_at: string | null
          recipient_email: string | null
          recipient_name: string | null
          solicitado_a: string | null
          solicitado_at: string | null
          status: string | null
          trafico_id: string
          upload_token_id: string | null
        }
        Insert: {
          channel?: string[] | null
          company_id?: string | null
          completed_at?: string | null
          created_by?: string | null
          deadline?: string | null
          doc_type: string
          doc_types?: string[] | null
          docs_received?: string[] | null
          email_sent_at?: string | null
          escalate_after?: string | null
          escalated_at?: string | null
          id?: string
          message?: string | null
          recibido_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          solicitado_a?: string | null
          solicitado_at?: string | null
          status?: string | null
          trafico_id: string
          upload_token_id?: string | null
        }
        Update: {
          channel?: string[] | null
          company_id?: string | null
          completed_at?: string | null
          created_by?: string | null
          deadline?: string | null
          doc_type?: string
          doc_types?: string[] | null
          docs_received?: string[] | null
          email_sent_at?: string | null
          escalate_after?: string | null
          escalated_at?: string | null
          id?: string
          message?: string | null
          recibido_at?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          solicitado_a?: string | null
          solicitado_at?: string | null
          status?: string | null
          trafico_id?: string
          upload_token_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          broker_id: string | null
          company_id: string | null
          created_at: string | null
          document_type: string | null
          extracted_at: string | null
          extracted_data: Json | null
          extraction_source: string | null
          file_url: string | null
          generated_by: string | null
          id: string
          metadata: Json | null
          shipment_id: string | null
          tenant_slug: string | null
          trafico_id: string | null
        }
        Insert: {
          broker_id?: string | null
          company_id?: string | null
          created_at?: string | null
          document_type?: string | null
          extracted_at?: string | null
          extracted_data?: Json | null
          extraction_source?: string | null
          file_url?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          shipment_id?: string | null
          tenant_slug?: string | null
          trafico_id?: string | null
        }
        Update: {
          broker_id?: string | null
          company_id?: string | null
          created_at?: string | null
          document_type?: string | null
          extracted_at?: string | null
          extracted_data?: Json | null
          extraction_source?: string | null
          file_url?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          shipment_id?: string | null
          tenant_slug?: string | null
          trafico_id?: string | null
        }
        Relationships: []
      }
      draft_corrections: {
        Row: {
          corrected_by: string | null
          correction_note: string
          created_at: string | null
          draft_id: string | null
          id: string
        }
        Insert: {
          corrected_by?: string | null
          correction_note: string
          created_at?: string | null
          draft_id?: string | null
          id?: string
        }
        Update: {
          corrected_by?: string | null
          correction_note?: string
          created_at?: string | null
          draft_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_corrections_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "pedimento_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          assigned_to: string | null
          company_id: string
          contributions: Json | null
          created_at: string | null
          created_by: string | null
          draft_data: Json | null
          escalated_at: string | null
          escalation_level: number | null
          extracted_fields: Json | null
          id: string
          overall_confidence: number | null
          products: Json | null
          review_tier: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_email: string | null
          status: string
          trafico_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string
          contributions?: Json | null
          created_at?: string | null
          created_by?: string | null
          draft_data?: Json | null
          escalated_at?: string | null
          escalation_level?: number | null
          extracted_fields?: Json | null
          id?: string
          overall_confidence?: number | null
          products?: Json | null
          review_tier?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_email?: string | null
          status?: string
          trafico_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          contributions?: Json | null
          created_at?: string | null
          created_by?: string | null
          draft_data?: Json | null
          escalated_at?: string | null
          escalation_level?: number | null
          extracted_fields?: Json | null
          id?: string
          overall_confidence?: number | null
          products?: Json | null
          review_tier?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_email?: string | null
          status?: string
          trafico_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      duplicates_detected: {
        Row: {
          company_id: string | null
          confidence: number | null
          detected_at: string | null
          duplicate_type: string | null
          id: string
          invoice_number: string | null
          status: string | null
          supplier: string | null
          trafico_id_1: string | null
          trafico_id_2: string | null
          value: number | null
        }
        Insert: {
          company_id?: string | null
          confidence?: number | null
          detected_at?: string | null
          duplicate_type?: string | null
          id?: string
          invoice_number?: string | null
          status?: string | null
          supplier?: string | null
          trafico_id_1?: string | null
          trafico_id_2?: string | null
          value?: number | null
        }
        Update: {
          company_id?: string | null
          confidence?: number | null
          detected_at?: string | null
          duplicate_type?: string | null
          id?: string
          invoice_number?: string | null
          status?: string | null
          supplier?: string | null
          trafico_id_1?: string | null
          trafico_id_2?: string | null
          value?: number | null
        }
        Relationships: []
      }
      econta_anticipos: {
        Row: {
          concepto: string | null
          consecutivo: number | null
          created_at: string | null
          cuenta_contable: string | null
          cve_cliente: string | null
          fecha: string | null
          id: number
          importe: number | null
          moneda: string | null
          oficina: number | null
          referencia: string | null
          tenant_id: string | null
          tipo_cambio: number | null
        }
        Insert: {
          concepto?: string | null
          consecutivo?: number | null
          created_at?: string | null
          cuenta_contable?: string | null
          cve_cliente?: string | null
          fecha?: string | null
          id?: number
          importe?: number | null
          moneda?: string | null
          oficina?: number | null
          referencia?: string | null
          tenant_id?: string | null
          tipo_cambio?: number | null
        }
        Update: {
          concepto?: string | null
          consecutivo?: number | null
          created_at?: string | null
          cuenta_contable?: string | null
          cve_cliente?: string | null
          fecha?: string | null
          id?: number
          importe?: number | null
          moneda?: string | null
          oficina?: number | null
          referencia?: string | null
          tenant_id?: string | null
          tipo_cambio?: number | null
        }
        Relationships: []
      }
      econta_antiguedad: {
        Row: {
          clave_cliente: string
          created_at: string | null
          docs_vencidos: number | null
          id: string
          nombre_cliente: string
          rango_1_30: number | null
          rango_31_60: number | null
          rango_61_90: number | null
          rango_90_plus: number | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          clave_cliente: string
          created_at?: string | null
          docs_vencidos?: number | null
          id?: string
          nombre_cliente: string
          rango_1_30?: number | null
          rango_31_60?: number | null
          rango_61_90?: number | null
          rango_90_plus?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          clave_cliente?: string
          created_at?: string | null
          docs_vencidos?: number | null
          id?: string
          nombre_cliente?: string
          rango_1_30?: number | null
          rango_31_60?: number | null
          rango_61_90?: number | null
          rango_90_plus?: number | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      econta_aplicaciones: {
        Row: {
          consecutivo: number | null
          consecutivo_abono: number | null
          consecutivo_cargo: number | null
          created_at: string | null
          fecha: string | null
          id: number
          importe: number | null
          tenant_id: string | null
        }
        Insert: {
          consecutivo?: number | null
          consecutivo_abono?: number | null
          consecutivo_cargo?: number | null
          created_at?: string | null
          fecha?: string | null
          id?: number
          importe?: number | null
          tenant_id?: string | null
        }
        Update: {
          consecutivo?: number | null
          consecutivo_abono?: number | null
          consecutivo_cargo?: number | null
          created_at?: string | null
          fecha?: string | null
          id?: number
          importe?: number | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      econta_ba_anticipos: {
        Row: {
          dfecha: string | null
          dfechaactualizacion: string | null
          dfechaingreso: string | null
          erevolvente: string | null
          estatus: string | null
          iconsecutivo: number | null
          iconsecutivocartera: number | null
          iconsecutivoegresos: string | null
          iconsecutivoingresos: number | null
          icveoficina: number | null
          id: string
          irelacionanticipo: number | null
          itipocambio: number | null
          rimporte: number | null
          scvecliente: string | null
          scvemoneda: string | null
          sfolio: string | null
          sipactualizacion: string | null
          sipingreso: string | null
          sreferencia: string | null
          sserie: string | null
          susuarioactualizacion: string | null
          susuarioingreso: string | null
        }
        Insert: {
          dfecha?: string | null
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          erevolvente?: string | null
          estatus?: string | null
          iconsecutivo?: number | null
          iconsecutivocartera?: number | null
          iconsecutivoegresos?: string | null
          iconsecutivoingresos?: number | null
          icveoficina?: number | null
          id?: string
          irelacionanticipo?: number | null
          itipocambio?: number | null
          rimporte?: number | null
          scvecliente?: string | null
          scvemoneda?: string | null
          sfolio?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          sreferencia?: string | null
          sserie?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Update: {
          dfecha?: string | null
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          erevolvente?: string | null
          estatus?: string | null
          iconsecutivo?: number | null
          iconsecutivocartera?: number | null
          iconsecutivoegresos?: string | null
          iconsecutivoingresos?: number | null
          icveoficina?: number | null
          id?: string
          irelacionanticipo?: number | null
          itipocambio?: number | null
          rimporte?: number | null
          scvecliente?: string | null
          scvemoneda?: string | null
          sfolio?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          sreferencia?: string | null
          sserie?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Relationships: []
      }
      econta_ba_egresos: {
        Row: {
          beliminado: number | null
          dfecha: string | null
          dfechaactualizacion: string | null
          dfechaingreso: string | null
          eformaegreso: string | null
          iconsecutivo: number | null
          iconsecutivooficina: number | null
          id: string
          itipocambio: number | null
          rimporte: number | null
          sbeneficiario: string | null
          sconcepto: string | null
          scuentacontable: string | null
          scuentacontabledestino: string | null
          scvecliente: string | null
          scvemoneda: string | null
          scvemonedadestino: string | null
          scveproveedor: string | null
          sdescripcionoficina: string | null
          sipactualizacion: string | null
          sipingreso: string | null
          sreferencia: string | null
          stipoegreso: string | null
          susuarioactualizacion: string | null
          susuarioingreso: string | null
        }
        Insert: {
          beliminado?: number | null
          dfecha?: string | null
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          eformaegreso?: string | null
          iconsecutivo?: number | null
          iconsecutivooficina?: number | null
          id?: string
          itipocambio?: number | null
          rimporte?: number | null
          sbeneficiario?: string | null
          sconcepto?: string | null
          scuentacontable?: string | null
          scuentacontabledestino?: string | null
          scvecliente?: string | null
          scvemoneda?: string | null
          scvemonedadestino?: string | null
          scveproveedor?: string | null
          sdescripcionoficina?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          sreferencia?: string | null
          stipoegreso?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Update: {
          beliminado?: number | null
          dfecha?: string | null
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          eformaegreso?: string | null
          iconsecutivo?: number | null
          iconsecutivooficina?: number | null
          id?: string
          itipocambio?: number | null
          rimporte?: number | null
          sbeneficiario?: string | null
          sconcepto?: string | null
          scuentacontable?: string | null
          scuentacontabledestino?: string | null
          scvecliente?: string | null
          scvemoneda?: string | null
          scvemonedadestino?: string | null
          scveproveedor?: string | null
          sdescripcionoficina?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          sreferencia?: string | null
          stipoegreso?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Relationships: []
      }
      econta_ba_ingresos: {
        Row: {
          beliminado: number | null
          dfecha: string | null
          dfechaactualizacion: string | null
          dfechaingreso: string | null
          eformaingreso: string | null
          iconsecutivo: number | null
          iconsecutivooficina: number | null
          id: string
          itipocambio: number | null
          rimporte: number | null
          rimporteanticipo: number | null
          rimportepagofactura: number | null
          sconcepto: string | null
          sctabeneficiario: string | null
          sctaordenante: string | null
          scuentacontable: string | null
          scvecliente: string | null
          scvecorresponsal: string | null
          scveformapago: string | null
          scvemoneda: string | null
          sdescripcionoficina: string | null
          sipactualizacion: string | null
          sipingreso: string | null
          snombancoordext: string | null
          snumoperacion: string | null
          sreferencia: string | null
          srfcemisorctaben: string | null
          srfcemisorctaord: string | null
          stipoingreso: string | null
          straspasocuentoorigen: string | null
          susuarioactualizacion: string | null
          susuarioingreso: string | null
        }
        Insert: {
          beliminado?: number | null
          dfecha?: string | null
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          eformaingreso?: string | null
          iconsecutivo?: number | null
          iconsecutivooficina?: number | null
          id?: string
          itipocambio?: number | null
          rimporte?: number | null
          rimporteanticipo?: number | null
          rimportepagofactura?: number | null
          sconcepto?: string | null
          sctabeneficiario?: string | null
          sctaordenante?: string | null
          scuentacontable?: string | null
          scvecliente?: string | null
          scvecorresponsal?: string | null
          scveformapago?: string | null
          scvemoneda?: string | null
          sdescripcionoficina?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          snombancoordext?: string | null
          snumoperacion?: string | null
          sreferencia?: string | null
          srfcemisorctaben?: string | null
          srfcemisorctaord?: string | null
          stipoingreso?: string | null
          straspasocuentoorigen?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Update: {
          beliminado?: number | null
          dfecha?: string | null
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          eformaingreso?: string | null
          iconsecutivo?: number | null
          iconsecutivooficina?: number | null
          id?: string
          itipocambio?: number | null
          rimporte?: number | null
          rimporteanticipo?: number | null
          rimportepagofactura?: number | null
          sconcepto?: string | null
          sctabeneficiario?: string | null
          sctaordenante?: string | null
          scuentacontable?: string | null
          scvecliente?: string | null
          scvecorresponsal?: string | null
          scveformapago?: string | null
          scvemoneda?: string | null
          sdescripcionoficina?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          snombancoordext?: string | null
          snumoperacion?: string | null
          sreferencia?: string | null
          srfcemisorctaben?: string | null
          srfcemisorctaord?: string | null
          stipoingreso?: string | null
          straspasocuentoorigen?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Relationships: []
      }
      econta_cartera: {
        Row: {
          consecutivo: number | null
          created_at: string | null
          cve_cliente: string | null
          fecha: string | null
          fecha_vencimiento: string | null
          id: number
          importe: number | null
          moneda: string | null
          observaciones: string | null
          referencia: string | null
          saldo: number | null
          tenant_id: string | null
          tipo: string | null
          tipo_cambio: number | null
        }
        Insert: {
          consecutivo?: number | null
          created_at?: string | null
          cve_cliente?: string | null
          fecha?: string | null
          fecha_vencimiento?: string | null
          id?: number
          importe?: number | null
          moneda?: string | null
          observaciones?: string | null
          referencia?: string | null
          saldo?: number | null
          tenant_id?: string | null
          tipo?: string | null
          tipo_cambio?: number | null
        }
        Update: {
          consecutivo?: number | null
          created_at?: string | null
          cve_cliente?: string | null
          fecha?: string | null
          fecha_vencimiento?: string | null
          id?: number
          importe?: number | null
          moneda?: string | null
          observaciones?: string | null
          referencia?: string | null
          saldo?: number | null
          tenant_id?: string | null
          tipo?: string | null
          tipo_cambio?: number | null
        }
        Relationships: []
      }
      econta_cl_aplicaciones: {
        Row: {
          dfechaactualizacion: string | null
          dfechaaplicacion: string | null
          dfechaingreso: string | null
          iconsecutivo: number | null
          iconsecutivocarteraabono: number | null
          iconsecutivocarteracargo: number | null
          id: string
          rimporte: number | null
          scvecliente: string | null
          sipactualizacion: string | null
          sipingreso: string | null
          susuarioactualizacion: string | null
          susuarioingreso: string | null
        }
        Insert: {
          dfechaactualizacion?: string | null
          dfechaaplicacion?: string | null
          dfechaingreso?: string | null
          iconsecutivo?: number | null
          iconsecutivocarteraabono?: number | null
          iconsecutivocarteracargo?: number | null
          id?: string
          rimporte?: number | null
          scvecliente?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Update: {
          dfechaactualizacion?: string | null
          dfechaaplicacion?: string | null
          dfechaingreso?: string | null
          iconsecutivo?: number | null
          iconsecutivocarteraabono?: number | null
          iconsecutivocarteracargo?: number | null
          id?: string
          rimporte?: number | null
          scvecliente?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Relationships: []
      }
      econta_egresos: {
        Row: {
          beneficiario: string | null
          concepto: string | null
          consecutivo: number | null
          created_at: string | null
          cuenta_contable: string | null
          cve_cliente: string | null
          cve_proveedor: string | null
          fecha: string | null
          forma_egreso: string | null
          id: number
          importe: number | null
          moneda: string | null
          referencia: string | null
          tenant_id: string | null
          tipo_cambio: number | null
          tipo_egreso: string | null
        }
        Insert: {
          beneficiario?: string | null
          concepto?: string | null
          consecutivo?: number | null
          created_at?: string | null
          cuenta_contable?: string | null
          cve_cliente?: string | null
          cve_proveedor?: string | null
          fecha?: string | null
          forma_egreso?: string | null
          id?: number
          importe?: number | null
          moneda?: string | null
          referencia?: string | null
          tenant_id?: string | null
          tipo_cambio?: number | null
          tipo_egreso?: string | null
        }
        Update: {
          beneficiario?: string | null
          concepto?: string | null
          consecutivo?: number | null
          created_at?: string | null
          cuenta_contable?: string | null
          cve_cliente?: string | null
          cve_proveedor?: string | null
          fecha?: string | null
          forma_egreso?: string | null
          id?: number
          importe?: number | null
          moneda?: string | null
          referencia?: string | null
          tenant_id?: string | null
          tipo_cambio?: number | null
          tipo_egreso?: string | null
        }
        Relationships: []
      }
      econta_factura_aa: {
        Row: {
          beliminado: number | null
          bestatus: number | null
          dfechaactualizacion: string | null
          dfechahora: string | null
          dfechaingreso: string | null
          iconsecutivo: number | null
          icveoficina: number | null
          id: string
          rhonorarios: number | null
          riva: number | null
          rtipocambio: number | null
          rtotal: number | null
          scvecliente: string | null
          sdescripcionmercancia: string | null
          snombrecliente: string | null
          spatente: string | null
          spedimento: string | null
          sreferencia: string | null
          srfccliente: string | null
          susuarioactualizacion: string | null
          susuarioingreso: string | null
        }
        Insert: {
          beliminado?: number | null
          bestatus?: number | null
          dfechaactualizacion?: string | null
          dfechahora?: string | null
          dfechaingreso?: string | null
          iconsecutivo?: number | null
          icveoficina?: number | null
          id?: string
          rhonorarios?: number | null
          riva?: number | null
          rtipocambio?: number | null
          rtotal?: number | null
          scvecliente?: string | null
          sdescripcionmercancia?: string | null
          snombrecliente?: string | null
          spatente?: string | null
          spedimento?: string | null
          sreferencia?: string | null
          srfccliente?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Update: {
          beliminado?: number | null
          bestatus?: number | null
          dfechaactualizacion?: string | null
          dfechahora?: string | null
          dfechaingreso?: string | null
          iconsecutivo?: number | null
          icveoficina?: number | null
          id?: string
          rhonorarios?: number | null
          riva?: number | null
          rtipocambio?: number | null
          rtotal?: number | null
          scvecliente?: string | null
          sdescripcionmercancia?: string | null
          snombrecliente?: string | null
          spatente?: string | null
          spedimento?: string | null
          sreferencia?: string | null
          srfccliente?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Relationships: []
      }
      econta_factura_detalle: {
        Row: {
          dfechaactualizacion: string | null
          dfechaingreso: string | null
          eclasificacion: string | null
          iconsecutivogeneral: number | null
          id: string
          ifolio: number | null
          rcantidad: number | null
          rimportefd: number | null
          rivafd: number | null
          rpreciounitario: number | null
          rtotalfd: number | null
          sclavepssat: string | null
          sdescripcionserviciofd: string | null
          sreferencia: string | null
          sserviciofd: string | null
          susuarioactualizacion: string | null
          susuarioingreso: string | null
        }
        Insert: {
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          eclasificacion?: string | null
          iconsecutivogeneral?: number | null
          id?: string
          ifolio?: number | null
          rcantidad?: number | null
          rimportefd?: number | null
          rivafd?: number | null
          rpreciounitario?: number | null
          rtotalfd?: number | null
          sclavepssat?: string | null
          sdescripcionserviciofd?: string | null
          sreferencia?: string | null
          sserviciofd?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Update: {
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          eclasificacion?: string | null
          iconsecutivogeneral?: number | null
          id?: string
          ifolio?: number | null
          rcantidad?: number | null
          rimportefd?: number | null
          rivafd?: number | null
          rpreciounitario?: number | null
          rtotalfd?: number | null
          sclavepssat?: string | null
          sdescripcionserviciofd?: string | null
          sreferencia?: string | null
          sserviciofd?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
        }
        Relationships: []
      }
      econta_facturacion: {
        Row: {
          clave_cliente: string
          created_at: string | null
          id: string
          nombre_cliente: string
          porcentaje: number | null
          total_facturado: number | null
          updated_at: string | null
        }
        Insert: {
          clave_cliente: string
          created_at?: string | null
          id?: string
          nombre_cliente: string
          porcentaje?: number | null
          total_facturado?: number | null
          updated_at?: string | null
        }
        Update: {
          clave_cliente?: string
          created_at?: string | null
          id?: string
          nombre_cliente?: string
          porcentaje?: number | null
          total_facturado?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      econta_facturas: {
        Row: {
          consecutivo: number | null
          created_at: string | null
          cve_cliente: string | null
          cve_oficina: number | null
          fecha: string | null
          folio: number | null
          id: number
          iva: number | null
          moneda: string | null
          observaciones: string | null
          serie: string | null
          subtotal: number | null
          tenant_id: string | null
          tipo_cambio: number | null
          tipo_factura: string | null
          total: number | null
        }
        Insert: {
          consecutivo?: number | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_oficina?: number | null
          fecha?: string | null
          folio?: number | null
          id?: number
          iva?: number | null
          moneda?: string | null
          observaciones?: string | null
          serie?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          tipo_cambio?: number | null
          tipo_factura?: string | null
          total?: number | null
        }
        Update: {
          consecutivo?: number | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_oficina?: number | null
          fecha?: string | null
          folio?: number | null
          id?: number
          iva?: number | null
          moneda?: string | null
          observaciones?: string | null
          serie?: string | null
          subtotal?: number | null
          tenant_id?: string | null
          tipo_cambio?: number | null
          tipo_factura?: string | null
          total?: number | null
        }
        Relationships: []
      }
      econta_facturas_detalle: {
        Row: {
          consecutivo: number | null
          consecutivo_factura: number | null
          created_at: string | null
          descripcion: string | null
          id: number
          importe: number | null
          iva: number | null
          referencia: string | null
          tenant_id: string | null
        }
        Insert: {
          consecutivo?: number | null
          consecutivo_factura?: number | null
          created_at?: string | null
          descripcion?: string | null
          id?: number
          importe?: number | null
          iva?: number | null
          referencia?: string | null
          tenant_id?: string | null
        }
        Update: {
          consecutivo?: number | null
          consecutivo_factura?: number | null
          created_at?: string | null
          descripcion?: string | null
          id?: number
          importe?: number | null
          iva?: number | null
          referencia?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      econta_gastos_comprobados: {
        Row: {
          cantidad: number | null
          cliente: string
          created_at: string | null
          fecha: string | null
          folio: string | null
          id: string
          proveedor: string | null
          referencia: string | null
          saldo: number | null
          saldo_gc: number | null
          serie: string | null
          servicio: string | null
          updated_at: string | null
        }
        Insert: {
          cantidad?: number | null
          cliente: string
          created_at?: string | null
          fecha?: string | null
          folio?: string | null
          id?: string
          proveedor?: string | null
          referencia?: string | null
          saldo?: number | null
          saldo_gc?: number | null
          serie?: string | null
          servicio?: string | null
          updated_at?: string | null
        }
        Update: {
          cantidad?: number | null
          cliente?: string
          created_at?: string | null
          fecha?: string | null
          folio?: string | null
          id?: string
          proveedor?: string | null
          referencia?: string | null
          saldo?: number | null
          saldo_gc?: number | null
          serie?: string | null
          servicio?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      econta_ingresos: {
        Row: {
          concepto: string | null
          consecutivo: number | null
          created_at: string | null
          cuenta_contable: string | null
          cve_cliente: string | null
          fecha: string | null
          forma_ingreso: string | null
          id: number
          importe: number | null
          moneda: string | null
          oficina: number | null
          referencia: string | null
          tenant_id: string | null
          tipo_cambio: number | null
          tipo_ingreso: string | null
        }
        Insert: {
          concepto?: string | null
          consecutivo?: number | null
          created_at?: string | null
          cuenta_contable?: string | null
          cve_cliente?: string | null
          fecha?: string | null
          forma_ingreso?: string | null
          id?: number
          importe?: number | null
          moneda?: string | null
          oficina?: number | null
          referencia?: string | null
          tenant_id?: string | null
          tipo_cambio?: number | null
          tipo_ingreso?: string | null
        }
        Update: {
          concepto?: string | null
          consecutivo?: number | null
          created_at?: string | null
          cuenta_contable?: string | null
          cve_cliente?: string | null
          fecha?: string | null
          forma_ingreso?: string | null
          id?: number
          importe?: number | null
          moneda?: string | null
          oficina?: number | null
          referencia?: string | null
          tenant_id?: string | null
          tipo_cambio?: number | null
          tipo_ingreso?: string | null
        }
        Relationships: []
      }
      econta_poliza_detalle: {
        Row: {
          dfechaactualizacion: string | null
          dfechaingreso: string | null
          dsubtotalxml: number | null
          iacontaid: number | null
          iconsecutivo: number | null
          iconsecutivocliente: number | null
          iconsecutivopoliza: number | null
          id: string
          rabono: number | null
          rcargo: number | null
          riva: number | null
          rretencion: number | null
          scuenta: string | null
          sdescripcion: string | null
          sipactualizacion: string | null
          sipingreso: string | null
          snofactura: string | null
          snombrecuenta: string | null
          sreferencia: string | null
          srfcproveedor: string | null
          susuarioactualizacion: string | null
          susuarioingreso: string | null
          suuid: string | null
        }
        Insert: {
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          dsubtotalxml?: number | null
          iacontaid?: number | null
          iconsecutivo?: number | null
          iconsecutivocliente?: number | null
          iconsecutivopoliza?: number | null
          id?: string
          rabono?: number | null
          rcargo?: number | null
          riva?: number | null
          rretencion?: number | null
          scuenta?: string | null
          sdescripcion?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          snofactura?: string | null
          snombrecuenta?: string | null
          sreferencia?: string | null
          srfcproveedor?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
          suuid?: string | null
        }
        Update: {
          dfechaactualizacion?: string | null
          dfechaingreso?: string | null
          dsubtotalxml?: number | null
          iacontaid?: number | null
          iconsecutivo?: number | null
          iconsecutivocliente?: number | null
          iconsecutivopoliza?: number | null
          id?: string
          rabono?: number | null
          rcargo?: number | null
          riva?: number | null
          rretencion?: number | null
          scuenta?: string | null
          sdescripcion?: string | null
          sipactualizacion?: string | null
          sipingreso?: string | null
          snofactura?: string | null
          snombrecuenta?: string | null
          sreferencia?: string | null
          srfcproveedor?: string | null
          susuarioactualizacion?: string | null
          susuarioingreso?: string | null
          suuid?: string | null
        }
        Relationships: []
      }
      econta_polizas: {
        Row: {
          consecutivo: number | null
          created_at: string | null
          cve_oficina: number | null
          fecha: string | null
          id: number
          importe: number | null
          num_documento: string | null
          numero_poliza: string | null
          observaciones: string | null
          tenant_id: string | null
          tipo_poliza: string | null
        }
        Insert: {
          consecutivo?: number | null
          created_at?: string | null
          cve_oficina?: number | null
          fecha?: string | null
          id?: number
          importe?: number | null
          num_documento?: string | null
          numero_poliza?: string | null
          observaciones?: string | null
          tenant_id?: string | null
          tipo_poliza?: string | null
        }
        Update: {
          consecutivo?: number | null
          created_at?: string | null
          cve_oficina?: number | null
          fecha?: string | null
          id?: number
          importe?: number | null
          num_documento?: string | null
          numero_poliza?: string | null
          observaciones?: string | null
          tenant_id?: string | null
          tipo_poliza?: string | null
        }
        Relationships: []
      }
      econta_registros: {
        Row: {
          aduana: string | null
          company_id: string | null
          consecutivo: number
          created_at: string | null
          cve_cliente: string | null
          descripcion_mercancia: string | null
          dta: number | null
          eliminado: boolean | null
          estatus: number | null
          facturas: string | null
          fecha: string | null
          folio_fiscal: string | null
          honorarios: number | null
          id: number
          igi: number | null
          iva: number | null
          nombre_cliente: string | null
          patente: string | null
          pedimento: string | null
          referencia: string | null
          rfc_cliente: string | null
          tenant_id: string | null
          tipo_cambio: number | null
          tipo_operacion: string | null
          total: number | null
          transportista_ext: string | null
          transportista_mex: string | null
          updated_at: string | null
          valor_aduanas: number | null
        }
        Insert: {
          aduana?: string | null
          company_id?: string | null
          consecutivo: number
          created_at?: string | null
          cve_cliente?: string | null
          descripcion_mercancia?: string | null
          dta?: number | null
          eliminado?: boolean | null
          estatus?: number | null
          facturas?: string | null
          fecha?: string | null
          folio_fiscal?: string | null
          honorarios?: number | null
          id?: number
          igi?: number | null
          iva?: number | null
          nombre_cliente?: string | null
          patente?: string | null
          pedimento?: string | null
          referencia?: string | null
          rfc_cliente?: string | null
          tenant_id?: string | null
          tipo_cambio?: number | null
          tipo_operacion?: string | null
          total?: number | null
          transportista_ext?: string | null
          transportista_mex?: string | null
          updated_at?: string | null
          valor_aduanas?: number | null
        }
        Update: {
          aduana?: string | null
          company_id?: string | null
          consecutivo?: number
          created_at?: string | null
          cve_cliente?: string | null
          descripcion_mercancia?: string | null
          dta?: number | null
          eliminado?: boolean | null
          estatus?: number | null
          facturas?: string | null
          fecha?: string | null
          folio_fiscal?: string | null
          honorarios?: number | null
          id?: number
          igi?: number | null
          iva?: number | null
          nombre_cliente?: string | null
          patente?: string | null
          pedimento?: string | null
          referencia?: string | null
          rfc_cliente?: string | null
          tenant_id?: string | null
          tipo_cambio?: number | null
          tipo_operacion?: string | null
          total?: number | null
          transportista_ext?: string | null
          transportista_mex?: string | null
          updated_at?: string | null
          valor_aduanas?: number | null
        }
        Relationships: []
      }
      econta_saldos: {
        Row: {
          clave_cliente: string
          created_at: string | null
          id: string
          nombre_cliente: string
          saldo: number | null
          updated_at: string | null
        }
        Insert: {
          clave_cliente: string
          created_at?: string | null
          id?: string
          nombre_cliente: string
          saldo?: number | null
          updated_at?: string | null
        }
        Update: {
          clave_cliente?: string
          created_at?: string | null
          id?: string
          nombre_cliente?: string
          saldo?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_classification_history: {
        Row: {
          account: string
          batch_id: string | null
          client_ref: string | null
          confidence: number | null
          created_at: string | null
          document_type: string | null
          email_id: string
          from_address: string | null
          id: number
          model: string | null
          received_at: string | null
          subject: string | null
          summary: string | null
          supplier_ref: string | null
          to_address: string | null
          urgency: string | null
        }
        Insert: {
          account: string
          batch_id?: string | null
          client_ref?: string | null
          confidence?: number | null
          created_at?: string | null
          document_type?: string | null
          email_id: string
          from_address?: string | null
          id?: number
          model?: string | null
          received_at?: string | null
          subject?: string | null
          summary?: string | null
          supplier_ref?: string | null
          to_address?: string | null
          urgency?: string | null
        }
        Update: {
          account?: string
          batch_id?: string | null
          client_ref?: string | null
          confidence?: number | null
          created_at?: string | null
          document_type?: string | null
          email_id?: string
          from_address?: string | null
          id?: number
          model?: string | null
          received_at?: string | null
          subject?: string | null
          summary?: string | null
          supplier_ref?: string | null
          to_address?: string | null
          urgency?: string | null
        }
        Relationships: []
      }
      email_extractions: {
        Row: {
          amount: number | null
          email_id: string | null
          id: string
          invoice_number: string | null
          processed_at: string | null
          raw_extraction: Json | null
          required_action: string | null
          sender: string | null
          subject: string | null
          trafico_id: string | null
          urgency: string | null
        }
        Insert: {
          amount?: number | null
          email_id?: string | null
          id?: string
          invoice_number?: string | null
          processed_at?: string | null
          raw_extraction?: Json | null
          required_action?: string | null
          sender?: string | null
          subject?: string | null
          trafico_id?: string | null
          urgency?: string | null
        }
        Update: {
          amount?: number | null
          email_id?: string | null
          id?: string
          invoice_number?: string | null
          processed_at?: string | null
          raw_extraction?: Json | null
          required_action?: string | null
          sender?: string | null
          subject?: string | null
          trafico_id?: string | null
          urgency?: string | null
        }
        Relationships: []
      }
      email_intake: {
        Row: {
          attachment_count: number
          company_id: string
          created_at: string
          gmail_message_id: string | null
          id: string
          received_at: string
          sender: string
          status: string
          subject: string
        }
        Insert: {
          attachment_count?: number
          company_id?: string
          created_at?: string
          gmail_message_id?: string | null
          id?: string
          received_at?: string
          sender: string
          status?: string
          subject?: string
        }
        Update: {
          attachment_count?: number
          company_id?: string
          created_at?: string
          gmail_message_id?: string | null
          id?: string
          received_at?: string
          sender?: string
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_intelligence: {
        Row: {
          created_at: string | null
          email_date: string | null
          fraccion: string | null
          id: string
          invoice_number: string | null
          raw_data: Json | null
          source_inbox: string | null
          supplier: string | null
          valor_usd: number | null
        }
        Insert: {
          created_at?: string | null
          email_date?: string | null
          fraccion?: string | null
          id?: string
          invoice_number?: string | null
          raw_data?: Json | null
          source_inbox?: string | null
          supplier?: string | null
          valor_usd?: number | null
        }
        Update: {
          created_at?: string | null
          email_date?: string | null
          fraccion?: string | null
          id?: string
          invoice_number?: string | null
          raw_data?: Json | null
          source_inbox?: string | null
          supplier?: string | null
          valor_usd?: number | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment_count: number | null
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          cc_address: string | null
          error_message: string | null
          generated_at: string | null
          id: string
          metadata: Json | null
          sent_at: string | null
          status: string | null
          subject: string
          tenant_slug: string | null
          to_address: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_count?: number | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_address?: string | null
          error_message?: string | null
          generated_at?: string | null
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          status?: string | null
          subject: string
          tenant_slug?: string | null
          to_address: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_count?: number | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_address?: string | null
          error_message?: string | null
          generated_at?: string | null
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          tenant_slug?: string | null
          to_address?: string
        }
        Relationships: []
      }
      entrada_lifecycle: {
        Row: {
          bultos: number | null
          company_id: string
          created_at: string | null
          email_from: string | null
          email_received_at: string | null
          email_subject: string | null
          entrada_number: string
          fecha_cruce: string | null
          id: string
          part_descriptions: string[] | null
          pedimento: string | null
          pedimento_transmitted_at: string | null
          peso_bruto: number | null
          semaforo: number | null
          status: string | null
          supplier: string | null
          trafico_assigned_at: string | null
          trafico_id: string | null
          transportista: string | null
        }
        Insert: {
          bultos?: number | null
          company_id: string
          created_at?: string | null
          email_from?: string | null
          email_received_at?: string | null
          email_subject?: string | null
          entrada_number: string
          fecha_cruce?: string | null
          id?: string
          part_descriptions?: string[] | null
          pedimento?: string | null
          pedimento_transmitted_at?: string | null
          peso_bruto?: number | null
          semaforo?: number | null
          status?: string | null
          supplier?: string | null
          trafico_assigned_at?: string | null
          trafico_id?: string | null
          transportista?: string | null
        }
        Update: {
          bultos?: number | null
          company_id?: string
          created_at?: string | null
          email_from?: string | null
          email_received_at?: string | null
          email_subject?: string | null
          entrada_number?: string
          fecha_cruce?: string | null
          id?: string
          part_descriptions?: string[] | null
          pedimento?: string | null
          pedimento_transmitted_at?: string | null
          peso_bruto?: number | null
          semaforo?: number | null
          status?: string | null
          supplier?: string | null
          trafico_assigned_at?: string | null
          trafico_id?: string | null
          transportista?: string | null
        }
        Relationships: []
      }
      entradas: {
        Row: {
          broker_id: string | null
          cantidad_bultos: number | null
          comentarios_danada: string | null
          comentarios_faltantes: string | null
          comentarios_generales: string | null
          company_id: string | null
          created_at: string | null
          cve_cliente: string | null
          cve_embarque: number | null
          cve_entrada: string
          cve_proveedor: string | null
          descripcion_mercancia: string | null
          embarcador: string | null
          fecha_actualizacion: string | null
          fecha_ingreso: string | null
          fecha_llegada_mercancia: string | null
          flete_pagado: number | null
          id: number
          in_bond: boolean | null
          material_peligroso: boolean | null
          mercancia_danada: boolean | null
          num_caja_trailer: string | null
          num_pedido: string | null
          num_talon: string | null
          peso_bruto: number | null
          peso_neto: number | null
          prioridad: string | null
          recibido_por: string | null
          recibio_facturas: boolean | null
          recibio_packing_list: boolean | null
          tenant_id: string | null
          tenant_slug: string | null
          tiene_faltantes: boolean | null
          tipo_carga: string | null
          tipo_operacion: string | null
          trafico: string | null
          transportista_americano: string | null
          transportista_mexicano: string | null
          updated_at: string | null
        }
        Insert: {
          broker_id?: string | null
          cantidad_bultos?: number | null
          comentarios_danada?: string | null
          comentarios_faltantes?: string | null
          comentarios_generales?: string | null
          company_id?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_embarque?: number | null
          cve_entrada: string
          cve_proveedor?: string | null
          descripcion_mercancia?: string | null
          embarcador?: string | null
          fecha_actualizacion?: string | null
          fecha_ingreso?: string | null
          fecha_llegada_mercancia?: string | null
          flete_pagado?: number | null
          id?: number
          in_bond?: boolean | null
          material_peligroso?: boolean | null
          mercancia_danada?: boolean | null
          num_caja_trailer?: string | null
          num_pedido?: string | null
          num_talon?: string | null
          peso_bruto?: number | null
          peso_neto?: number | null
          prioridad?: string | null
          recibido_por?: string | null
          recibio_facturas?: boolean | null
          recibio_packing_list?: boolean | null
          tenant_id?: string | null
          tenant_slug?: string | null
          tiene_faltantes?: boolean | null
          tipo_carga?: string | null
          tipo_operacion?: string | null
          trafico?: string | null
          transportista_americano?: string | null
          transportista_mexicano?: string | null
          updated_at?: string | null
        }
        Update: {
          broker_id?: string | null
          cantidad_bultos?: number | null
          comentarios_danada?: string | null
          comentarios_faltantes?: string | null
          comentarios_generales?: string | null
          company_id?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_embarque?: number | null
          cve_entrada?: string
          cve_proveedor?: string | null
          descripcion_mercancia?: string | null
          embarcador?: string | null
          fecha_actualizacion?: string | null
          fecha_ingreso?: string | null
          fecha_llegada_mercancia?: string | null
          flete_pagado?: number | null
          id?: number
          in_bond?: boolean | null
          material_peligroso?: boolean | null
          mercancia_danada?: boolean | null
          num_caja_trailer?: string | null
          num_pedido?: string | null
          num_talon?: string | null
          peso_bruto?: number | null
          peso_neto?: number | null
          prioridad?: string | null
          recibido_por?: string | null
          recibio_facturas?: boolean | null
          recibio_packing_list?: boolean | null
          tenant_id?: string | null
          tenant_slug?: string | null
          tiene_faltantes?: boolean | null
          tipo_carga?: string | null
          tipo_operacion?: string | null
          trafico?: string | null
          transportista_americano?: string | null
          transportista_mexicano?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      entradas_bodega: {
        Row: {
          bultos: number | null
          company_id: string
          created_at: string | null
          entrada_number: string
          id: string
          notes: string | null
          peso_bruto: number | null
          source: string | null
          status: string | null
          supplier: string | null
          trafico_id: string | null
          transportista: string | null
          warehouse_received_at: string | null
        }
        Insert: {
          bultos?: number | null
          company_id: string
          created_at?: string | null
          entrada_number: string
          id?: string
          notes?: string | null
          peso_bruto?: number | null
          source?: string | null
          status?: string | null
          supplier?: string | null
          trafico_id?: string | null
          transportista?: string | null
          warehouse_received_at?: string | null
        }
        Update: {
          bultos?: number | null
          company_id?: string
          created_at?: string | null
          entrada_number?: string
          id?: string
          notes?: string | null
          peso_bruto?: number | null
          source?: string | null
          status?: string | null
          supplier?: string | null
          trafico_id?: string | null
          transportista?: string | null
          warehouse_received_at?: string | null
        }
        Relationships: []
      }
      expediente_coverage_history: {
        Row: {
          auto_fixed: number | null
          coverage_percent: number | null
          id: string
          matched: number | null
          needs_review: number | null
          recorded_at: string | null
          total_traficos: number | null
        }
        Insert: {
          auto_fixed?: number | null
          coverage_percent?: number | null
          id?: string
          matched?: number | null
          needs_review?: number | null
          recorded_at?: string | null
          total_traficos?: number | null
        }
        Update: {
          auto_fixed?: number | null
          coverage_percent?: number | null
          id?: string
          matched?: number | null
          needs_review?: number | null
          recorded_at?: string | null
          total_traficos?: number | null
        }
        Relationships: []
      }
      expediente_documentos: {
        Row: {
          company_id: string | null
          doc_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          metadata: Json | null
          pedimento_id: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          company_id?: string | null
          doc_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          metadata?: Json | null
          pedimento_id: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          company_id?: string | null
          doc_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          metadata?: Json | null
          pedimento_id?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: []
      }
      expediente_failure_log: {
        Row: {
          carrier: string | null
          client_id: string | null
          crossing: string | null
          doc_type: string | null
          failure_reason: string | null
          id: string
          pedimento: string | null
          resolved: boolean | null
          ts: string | null
        }
        Insert: {
          carrier?: string | null
          client_id?: string | null
          crossing?: string | null
          doc_type?: string | null
          failure_reason?: string | null
          id?: string
          pedimento?: string | null
          resolved?: boolean | null
          ts?: string | null
        }
        Update: {
          carrier?: string | null
          client_id?: string | null
          crossing?: string | null
          doc_type?: string | null
          failure_reason?: string | null
          id?: string
          pedimento?: string | null
          resolved?: boolean | null
          ts?: string | null
        }
        Relationships: []
      }
      expediente_repair_log: {
        Row: {
          category: number
          id: string
          new_value: string | null
          old_value: string | null
          repaired_at: string | null
          trafico_id: string
        }
        Insert: {
          category: number
          id?: string
          new_value?: string | null
          old_value?: string | null
          repaired_at?: string | null
          trafico_id: string
        }
        Update: {
          category?: number
          id?: string
          new_value?: string | null
          old_value?: string | null
          repaired_at?: string | null
          trafico_id?: string
        }
        Relationships: []
      }
      financial_intelligence: {
        Row: {
          avg_days_to_payment: number | null
          calculated_at: string | null
          company_id: string | null
          id: string
          operation_count: number | null
          outstanding_receivables: number | null
          period: string | null
          projected_next_month: number | null
          revenue_trend: string | null
          total_revenue: number | null
        }
        Insert: {
          avg_days_to_payment?: number | null
          calculated_at?: string | null
          company_id?: string | null
          id?: string
          operation_count?: number | null
          outstanding_receivables?: number | null
          period?: string | null
          projected_next_month?: number | null
          revenue_trend?: string | null
          total_revenue?: number | null
        }
        Update: {
          avg_days_to_payment?: number | null
          calculated_at?: string | null
          company_id?: string | null
          id?: string
          operation_count?: number | null
          outstanding_receivables?: number | null
          period?: string | null
          projected_next_month?: number | null
          revenue_trend?: string | null
          total_revenue?: number | null
        }
        Relationships: []
      }
      fold_daily: {
        Row: {
          beat_house: boolean | null
          card_body: number | null
          card_bonds: number | null
          card_build: number | null
          card_fuel: number | null
          card_growth: number | null
          card_people: number | null
          chip_delta: number | null
          created_at: string | null
          date: string
          energy_am: number | null
          energy_midday: number | null
          hand_avg: number | null
          hand_played: boolean | null
          hand_type: string | null
          house_bonus: number | null
          id: number
          journal: string | null
          player_id: string
        }
        Insert: {
          beat_house?: boolean | null
          card_body?: number | null
          card_bonds?: number | null
          card_build?: number | null
          card_fuel?: number | null
          card_growth?: number | null
          card_people?: number | null
          chip_delta?: number | null
          created_at?: string | null
          date: string
          energy_am?: number | null
          energy_midday?: number | null
          hand_avg?: number | null
          hand_played?: boolean | null
          hand_type?: string | null
          house_bonus?: number | null
          id?: number
          journal?: string | null
          player_id?: string
        }
        Update: {
          beat_house?: boolean | null
          card_body?: number | null
          card_bonds?: number | null
          card_build?: number | null
          card_fuel?: number | null
          card_growth?: number | null
          card_people?: number | null
          chip_delta?: number | null
          created_at?: string | null
          date?: string
          energy_am?: number | null
          energy_midday?: number | null
          hand_avg?: number | null
          hand_played?: boolean | null
          hand_type?: string | null
          house_bonus?: number | null
          id?: number
          journal?: string | null
          player_id?: string
        }
        Relationships: []
      }
      fold_house: {
        Row: {
          created_at: string | null
          date: string
          house_body: number | null
          house_build: number | null
          house_fuel: number | null
          house_hand_avg: number | null
          house_hand_type: string | null
          house_people: number | null
          id: number
        }
        Insert: {
          created_at?: string | null
          date: string
          house_body?: number | null
          house_build?: number | null
          house_fuel?: number | null
          house_hand_avg?: number | null
          house_hand_type?: string | null
          house_people?: number | null
          id?: number
        }
        Update: {
          created_at?: string | null
          date?: string
          house_body?: number | null
          house_build?: number | null
          house_fuel?: number | null
          house_hand_avg?: number | null
          house_hand_type?: string | null
          house_people?: number | null
          id?: number
        }
        Relationships: []
      }
      fraccion_patterns: {
        Row: {
          alt_fracciones: Json | null
          ambiguous: boolean | null
          avg_unit_price: number | null
          computed_at: string | null
          confidence: number | null
          description_keywords: string[] | null
          fraccion: string
          id: number
          primary_countries: string[] | null
          primary_suppliers: string[] | null
          product_count: number | null
          supplier_count: number | null
          total_partida_count: number | null
        }
        Insert: {
          alt_fracciones?: Json | null
          ambiguous?: boolean | null
          avg_unit_price?: number | null
          computed_at?: string | null
          confidence?: number | null
          description_keywords?: string[] | null
          fraccion: string
          id?: number
          primary_countries?: string[] | null
          primary_suppliers?: string[] | null
          product_count?: number | null
          supplier_count?: number | null
          total_partida_count?: number | null
        }
        Update: {
          alt_fracciones?: Json | null
          ambiguous?: boolean | null
          avg_unit_price?: number | null
          computed_at?: string | null
          confidence?: number | null
          description_keywords?: string[] | null
          fraccion?: string
          id?: number
          primary_countries?: string[] | null
          primary_suppliers?: string[] | null
          product_count?: number | null
          supplier_count?: number | null
          total_partida_count?: number | null
        }
        Relationships: []
      }
      fracciones_kb: {
        Row: {
          arancel_mfn: number | null
          arancel_usmca: number | null
          audit_risk_level: string | null
          confidence_score: number | null
          created_at: string | null
          descripcion: string | null
          fraccion: string
          id: string
          notas: string | null
          source: string | null
          updated_at: string | null
          usmca_rule: string | null
          verified: boolean | null
        }
        Insert: {
          arancel_mfn?: number | null
          arancel_usmca?: number | null
          audit_risk_level?: string | null
          confidence_score?: number | null
          created_at?: string | null
          descripcion?: string | null
          fraccion: string
          id?: string
          notas?: string | null
          source?: string | null
          updated_at?: string | null
          usmca_rule?: string | null
          verified?: boolean | null
        }
        Update: {
          arancel_mfn?: number | null
          arancel_usmca?: number | null
          audit_risk_level?: string | null
          confidence_score?: number | null
          created_at?: string | null
          descripcion?: string | null
          fraccion?: string
          id?: string
          notas?: string | null
          source?: string | null
          updated_at?: string | null
          usmca_rule?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      ghost_detections: {
        Row: {
          check_type: string
          companies: Json | null
          description: string
          detected_at: string | null
          id: number
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          traficos: Json | null
        }
        Insert: {
          check_type: string
          companies?: Json | null
          description: string
          detected_at?: string | null
          id?: number
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          traficos?: Json | null
        }
        Update: {
          check_type?: string
          companies?: Json | null
          description?: string
          detected_at?: string | null
          id?: number
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          traficos?: Json | null
        }
        Relationships: []
      }
      ghost_pedimento_runs: {
        Row: {
          classification_tokens: number | null
          company_id: string
          confianza: string | null
          created_at: string | null
          draft_id: string | null
          duration_ms: number | null
          error_message: string | null
          extraction_tokens: number | null
          flags_count: number | null
          id: string
          referencia: string | null
          status: string
        }
        Insert: {
          classification_tokens?: number | null
          company_id: string
          confianza?: string | null
          created_at?: string | null
          draft_id?: string | null
          duration_ms?: number | null
          error_message?: string | null
          extraction_tokens?: number | null
          flags_count?: number | null
          id?: string
          referencia?: string | null
          status?: string
        }
        Update: {
          classification_tokens?: number | null
          company_id?: string
          confianza?: string | null
          created_at?: string | null
          draft_id?: string | null
          duration_ms?: number | null
          error_message?: string | null
          extraction_tokens?: number | null
          flags_count?: number | null
          id?: string
          referencia?: string | null
          status?: string
        }
        Relationships: []
      }
      ghost_traficos: {
        Row: {
          avg_days_between: number | null
          avg_value_usd: number | null
          company_id: string
          confidence: number | null
          created_at: string | null
          id: string
          last_arrival: string | null
          predicted_arrival_from: string
          predicted_arrival_to: string
          shipment_count: number | null
          status: string | null
          supplier_name: string
        }
        Insert: {
          avg_days_between?: number | null
          avg_value_usd?: number | null
          company_id?: string
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_arrival?: string | null
          predicted_arrival_from: string
          predicted_arrival_to: string
          shipment_count?: number | null
          status?: string | null
          supplier_name: string
        }
        Update: {
          avg_days_between?: number | null
          avg_value_usd?: number | null
          company_id?: string
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_arrival?: string | null
          predicted_arrival_from?: string
          predicted_arrival_to?: string
          shipment_count?: number | null
          status?: string | null
          supplier_name?: string
        }
        Relationships: []
      }
      globalpc_bultos: {
        Row: {
          cantidad: number | null
          consecutivo: number | null
          created_at: string | null
          cve_bulto: number | null
          cve_entrada: string | null
          descripcion: string | null
          id: number
          tenant_id: string | null
        }
        Insert: {
          cantidad?: number | null
          consecutivo?: number | null
          created_at?: string | null
          cve_bulto?: number | null
          cve_entrada?: string | null
          descripcion?: string | null
          id?: number
          tenant_id?: string | null
        }
        Update: {
          cantidad?: number | null
          consecutivo?: number | null
          created_at?: string | null
          cve_bulto?: number | null
          cve_entrada?: string | null
          descripcion?: string | null
          id?: number
          tenant_id?: string | null
        }
        Relationships: []
      }
      globalpc_contenedores: {
        Row: {
          consecutivo: number | null
          created_at: string | null
          cve_contenedor: string | null
          cve_trafico: string | null
          id: number
          numero_caja: string | null
          pais_transporte: string | null
          placas: string | null
          sello1: string | null
          sello2: string | null
          tenant_id: string | null
        }
        Insert: {
          consecutivo?: number | null
          created_at?: string | null
          cve_contenedor?: string | null
          cve_trafico?: string | null
          id?: number
          numero_caja?: string | null
          pais_transporte?: string | null
          placas?: string | null
          sello1?: string | null
          sello2?: string | null
          tenant_id?: string | null
        }
        Update: {
          consecutivo?: number | null
          created_at?: string | null
          cve_contenedor?: string | null
          cve_trafico?: string | null
          id?: number
          numero_caja?: string | null
          pais_transporte?: string | null
          placas?: string | null
          sello1?: string | null
          sello2?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      globalpc_eventos: {
        Row: {
          comentarios: string | null
          company_id: string | null
          consecutivo: number | null
          consecutivo_evento: number | null
          created_at: string | null
          cve_trafico: string | null
          fecha: string | null
          id: number
          registrado_por: string | null
          remesa: string | null
          tenant_id: string | null
        }
        Insert: {
          comentarios?: string | null
          company_id?: string | null
          consecutivo?: number | null
          consecutivo_evento?: number | null
          created_at?: string | null
          cve_trafico?: string | null
          fecha?: string | null
          id?: number
          registrado_por?: string | null
          remesa?: string | null
          tenant_id?: string | null
        }
        Update: {
          comentarios?: string | null
          company_id?: string | null
          consecutivo?: number | null
          consecutivo_evento?: number | null
          created_at?: string | null
          cve_trafico?: string | null
          fecha?: string | null
          id?: number
          registrado_por?: string | null
          remesa?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      globalpc_facturas: {
        Row: {
          company_id: string | null
          cove_vucem: string | null
          created_at: string | null
          cve_cliente: string | null
          cve_proveedor: string | null
          cve_trafico: string | null
          deducibles: number | null
          embalajes: number | null
          fecha_facturacion: string | null
          flete: number | null
          folio: number | null
          id: number
          incoterm: string | null
          incrementables: number | null
          moneda: string | null
          numero: string | null
          seguros: number | null
          tenant_id: string | null
          updated_at: string | null
          valor_comercial: number | null
        }
        Insert: {
          company_id?: string | null
          cove_vucem?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_proveedor?: string | null
          cve_trafico?: string | null
          deducibles?: number | null
          embalajes?: number | null
          fecha_facturacion?: string | null
          flete?: number | null
          folio?: number | null
          id?: number
          incoterm?: string | null
          incrementables?: number | null
          moneda?: string | null
          numero?: string | null
          seguros?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          valor_comercial?: number | null
        }
        Update: {
          company_id?: string | null
          cove_vucem?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_proveedor?: string | null
          cve_trafico?: string | null
          deducibles?: number | null
          embalajes?: number | null
          fecha_facturacion?: string | null
          flete?: number | null
          folio?: number | null
          id?: number
          incoterm?: string | null
          incrementables?: number | null
          moneda?: string | null
          numero?: string | null
          seguros?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          valor_comercial?: number | null
        }
        Relationships: []
      }
      globalpc_ordenes_carga: {
        Row: {
          consecutivo: number | null
          created_at: string | null
          cve_aduana: string | null
          cve_transfer: string | null
          fecha: string | null
          fecha_cruce: string | null
          fecha_salida: string | null
          id: number
          num_caja: string | null
          num_patente: string | null
          sellos: string | null
          tenant_id: string | null
          tipo_orden: string | null
        }
        Insert: {
          consecutivo?: number | null
          created_at?: string | null
          cve_aduana?: string | null
          cve_transfer?: string | null
          fecha?: string | null
          fecha_cruce?: string | null
          fecha_salida?: string | null
          id?: number
          num_caja?: string | null
          num_patente?: string | null
          sellos?: string | null
          tenant_id?: string | null
          tipo_orden?: string | null
        }
        Update: {
          consecutivo?: number | null
          created_at?: string | null
          cve_aduana?: string | null
          cve_transfer?: string | null
          fecha?: string | null
          fecha_cruce?: string | null
          fecha_salida?: string | null
          id?: number
          num_caja?: string | null
          num_patente?: string | null
          sellos?: string | null
          tenant_id?: string | null
          tipo_orden?: string | null
        }
        Relationships: []
      }
      globalpc_partidas: {
        Row: {
          cantidad: number | null
          company_id: string | null
          created_at: string | null
          cve_cliente: string | null
          cve_producto: string | null
          cve_proveedor: string | null
          folio: number | null
          id: number
          marca: string | null
          modelo: string | null
          numero_item: number | null
          pais_origen: string | null
          peso: number | null
          precio_unitario: number | null
          serie: string | null
          tenant_id: string | null
        }
        Insert: {
          cantidad?: number | null
          company_id?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_producto?: string | null
          cve_proveedor?: string | null
          folio?: number | null
          id?: number
          marca?: string | null
          modelo?: string | null
          numero_item?: number | null
          pais_origen?: string | null
          peso?: number | null
          precio_unitario?: number | null
          serie?: string | null
          tenant_id?: string | null
        }
        Update: {
          cantidad?: number | null
          company_id?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_producto?: string | null
          cve_proveedor?: string | null
          folio?: number | null
          id?: number
          marca?: string | null
          modelo?: string | null
          numero_item?: number | null
          pais_origen?: string | null
          peso?: number | null
          precio_unitario?: number | null
          serie?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      globalpc_productos: {
        Row: {
          company_id: string | null
          created_at: string | null
          cve_cliente: string | null
          cve_producto: string | null
          cve_proveedor: string | null
          descripcion: string | null
          descripcion_ingles: string | null
          fraccion: string | null
          fraccion_classified_at: string | null
          fraccion_source: string | null
          globalpc_folio: string | null
          id: number
          marca: string | null
          nico: string | null
          pais_origen: string | null
          precio_unitario: number | null
          tenant_id: string | null
          umt: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_producto?: string | null
          cve_proveedor?: string | null
          descripcion?: string | null
          descripcion_ingles?: string | null
          fraccion?: string | null
          fraccion_classified_at?: string | null
          fraccion_source?: string | null
          globalpc_folio?: string | null
          id?: number
          marca?: string | null
          nico?: string | null
          pais_origen?: string | null
          precio_unitario?: number | null
          tenant_id?: string | null
          umt?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_producto?: string | null
          cve_proveedor?: string | null
          descripcion?: string | null
          descripcion_ingles?: string | null
          fraccion?: string | null
          fraccion_classified_at?: string | null
          fraccion_source?: string | null
          globalpc_folio?: string | null
          id?: number
          marca?: string | null
          nico?: string | null
          pais_origen?: string | null
          precio_unitario?: number | null
          tenant_id?: string | null
          umt?: string | null
        }
        Relationships: []
      }
      globalpc_proveedores: {
        Row: {
          alias: string | null
          calle: string | null
          ciudad: string | null
          company_id: string | null
          contacto: string | null
          created_at: string | null
          cve_cliente: string | null
          cve_proveedor: string | null
          email_contacto: string | null
          id: number
          id_fiscal: string | null
          nombre: string | null
          pais: string | null
          telefono: string | null
          tenant_id: string | null
        }
        Insert: {
          alias?: string | null
          calle?: string | null
          ciudad?: string | null
          company_id?: string | null
          contacto?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_proveedor?: string | null
          email_contacto?: string | null
          id?: number
          id_fiscal?: string | null
          nombre?: string | null
          pais?: string | null
          telefono?: string | null
          tenant_id?: string | null
        }
        Update: {
          alias?: string | null
          calle?: string | null
          ciudad?: string | null
          company_id?: string | null
          contacto?: string | null
          created_at?: string | null
          cve_cliente?: string | null
          cve_proveedor?: string | null
          email_contacto?: string | null
          id?: number
          id_fiscal?: string | null
          nombre?: string | null
          pais?: string | null
          telefono?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      good_news_caps: {
        Row: {
          company_id: string
          count: number
          event_date: string
          event_type: string
          id: string
        }
        Insert: {
          company_id: string
          count?: number
          event_date?: string
          event_type: string
          id?: string
        }
        Update: {
          company_id?: string
          count?: number
          event_date?: string
          event_type?: string
          id?: string
        }
        Relationships: []
      }
      heartbeat_log: {
        Row: {
          all_ok: boolean
          checked_at: string | null
          details: Json | null
          id: number
          pm2_ok: boolean
          supabase_ms: number | null
          supabase_ok: boolean
          sync_age_hours: number | null
          sync_ok: boolean
          vercel_ms: number | null
          vercel_ok: boolean
        }
        Insert: {
          all_ok: boolean
          checked_at?: string | null
          details?: Json | null
          id?: never
          pm2_ok: boolean
          supabase_ms?: number | null
          supabase_ok: boolean
          sync_age_hours?: number | null
          sync_ok: boolean
          vercel_ms?: number | null
          vercel_ok: boolean
        }
        Update: {
          all_ok?: boolean
          checked_at?: string | null
          details?: Json | null
          id?: never
          pm2_ok?: boolean
          supabase_ms?: number | null
          supabase_ok?: boolean
          sync_age_hours?: number | null
          sync_ok?: boolean
          vercel_ms?: number | null
          vercel_ok?: boolean
        }
        Relationships: []
      }
      integration_health: {
        Row: {
          checked_at: string | null
          company_id: string | null
          error_message: string | null
          id: string
          integration_name: string | null
          response_time_ms: number | null
          status: string | null
        }
        Insert: {
          checked_at?: string | null
          company_id?: string | null
          error_message?: string | null
          id?: string
          integration_name?: string | null
          response_time_ms?: number | null
          status?: string | null
        }
        Update: {
          checked_at?: string | null
          company_id?: string | null
          error_message?: string | null
          id?: string
          integration_name?: string | null
          response_time_ms?: number | null
          status?: string | null
        }
        Relationships: []
      }
      intelligence_logs: {
        Row: {
          analysis: string | null
          counts: Json | null
          created_at: string | null
          generated_at: string | null
          id: string
          morning_report: string | null
          risks: string | null
          suppliers: string | null
        }
        Insert: {
          analysis?: string | null
          counts?: Json | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          morning_report?: string | null
          risks?: string | null
          suppliers?: string | null
        }
        Update: {
          analysis?: string | null
          counts?: Json | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          morning_report?: string | null
          risks?: string | null
          suppliers?: string | null
        }
        Relationships: []
      }
      interaction_events: {
        Row: {
          company_id: string | null
          created_at: string
          event_name: string | null
          event_type: string
          id: number
          operator_id: string | null
          page_path: string
          payload: Json | null
          session_id: string | null
          user_agent: string | null
          viewport: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          event_name?: string | null
          event_type: string
          id?: number
          operator_id?: string | null
          page_path: string
          payload?: Json | null
          session_id?: string | null
          user_agent?: string | null
          viewport?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          event_name?: string | null
          event_type?: string
          id?: number
          operator_id?: string | null
          page_path?: string
          payload?: Json | null
          session_id?: string | null
          user_agent?: string | null
          viewport?: string | null
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          created_at: string | null
          error_message: string | null
          finished_at: string | null
          host: string | null
          id: number
          job_name: string
          metadata: Json | null
          rows_failed: number | null
          rows_processed: number | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          host?: string | null
          id?: number
          job_name: string
          metadata?: Json | null
          rows_failed?: number | null
          rows_processed?: number | null
          started_at?: string
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          finished_at?: string | null
          host?: string | null
          id?: number
          job_name?: string
          metadata?: Json | null
          rows_failed?: number | null
          rows_processed?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          answer: string | null
          confidence_score: number | null
          created_at: string | null
          id: string
          last_updated: string | null
          question_variations: string[] | null
          times_used: number | null
          topic: string | null
        }
        Insert: {
          answer?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          question_variations?: string[] | null
          times_used?: number | null
          topic?: string | null
        }
        Update: {
          answer?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          question_variations?: string[] | null
          times_used?: number | null
          topic?: string | null
        }
        Relationships: []
      }
      kpi_snapshots: {
        Row: {
          computed_at: string | null
          metric: string
          periodo: string
          tenant_id: string
          value: number | null
        }
        Insert: {
          computed_at?: string | null
          metric: string
          periodo: string
          tenant_id: string
          value?: number | null
        }
        Update: {
          computed_at?: string | null
          metric?: string
          periodo?: string
          tenant_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      learned_patterns: {
        Row: {
          active: boolean | null
          confidence: number | null
          first_detected: string | null
          id: number
          last_confirmed: string | null
          pattern_key: string
          pattern_type: string
          pattern_value: string
          sample_size: number | null
          source: string | null
          superseded_by: number | null
        }
        Insert: {
          active?: boolean | null
          confidence?: number | null
          first_detected?: string | null
          id?: number
          last_confirmed?: string | null
          pattern_key: string
          pattern_type: string
          pattern_value: string
          sample_size?: number | null
          source?: string | null
          superseded_by?: number | null
        }
        Update: {
          active?: boolean | null
          confidence?: number | null
          first_detected?: string | null
          id?: number
          last_confirmed?: string | null
          pattern_key?: string
          pattern_type?: string
          pattern_value?: string
          sample_size?: number | null
          source?: string | null
          superseded_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learned_patterns_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "learned_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          alert_days_before: number | null
          company_id: string | null
          created_at: string | null
          document_name: string | null
          document_type: string | null
          expires_at: string | null
          id: string
          issued_date: string | null
          notes: string | null
          status: string | null
        }
        Insert: {
          alert_days_before?: number | null
          company_id?: string | null
          created_at?: string | null
          document_name?: string | null
          document_type?: string | null
          expires_at?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          status?: string | null
        }
        Update: {
          alert_days_before?: number | null
          company_id?: string | null
          created_at?: string | null
          document_name?: string | null
          document_type?: string | null
          expires_at?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          status?: string | null
        }
        Relationships: []
      }
      linkedin_drafts: {
        Row: {
          content: string | null
          created_at: string | null
          data_source: string | null
          engagement_notes: string | null
          format: string | null
          id: string
          posted_at: string | null
          status: string | null
          week_of: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          data_source?: string | null
          engagement_notes?: string | null
          format?: string | null
          id?: string
          posted_at?: string | null
          status?: string | null
          week_of?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          data_source?: string | null
          engagement_notes?: string | null
          format?: string | null
          id?: string
          posted_at?: string | null
          status?: string | null
          week_of?: string | null
        }
        Relationships: []
      }
      loop_briefs: {
        Row: {
          brief_text: string | null
          created_at: string
          day: string
          id: string
          user_id: string
          voice_dump_text: string | null
        }
        Insert: {
          brief_text?: string | null
          created_at?: string
          day: string
          id?: string
          user_id: string
          voice_dump_text?: string | null
        }
        Update: {
          brief_text?: string | null
          created_at?: string
          day?: string
          id?: string
          user_id?: string
          voice_dump_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loop_briefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "loop_users"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_cards: {
        Row: {
          created_at: string | null
          day: string | null
          detail: string | null
          id: string
          label: string
          points: number | null
          sort_order: number | null
          sub: string | null
          time_h: number | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          day?: string | null
          detail?: string | null
          id?: string
          label: string
          points?: number | null
          sort_order?: number | null
          sub?: string | null
          time_h?: number | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          day?: string | null
          detail?: string | null
          id?: string
          label?: string
          points?: number | null
          sort_order?: number | null
          sub?: string | null
          time_h?: number | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loop_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "loop_users"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_config: {
        Row: {
          active: boolean | null
          created_at: string | null
          cruz_sprint: string | null
          days: number
          experiment: string
          id: string
          metric: string
          start_date: string
          user_id: string | null
          verdict: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          cruz_sprint?: string | null
          days?: number
          experiment: string
          id?: string
          metric: string
          start_date?: string
          user_id?: string | null
          verdict?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          cruz_sprint?: string | null
          days?: number
          experiment?: string
          id?: string
          metric?: string
          start_date?: string
          user_id?: string | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loop_config_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_daily: {
        Row: {
          body: number | null
          created_at: string | null
          date: string
          energy: number | null
          focus: number | null
          id: string
          journal_gratitude: string | null
          journal_priority: string | null
          journal_win: string | null
          loop_metric_score: number | null
          mood: number | null
          training_day: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          body?: number | null
          created_at?: string | null
          date: string
          energy?: number | null
          focus?: number | null
          id?: string
          journal_gratitude?: string | null
          journal_priority?: string | null
          journal_win?: string | null
          loop_metric_score?: number | null
          mood?: number | null
          training_day?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          body?: number | null
          created_at?: string | null
          date?: string
          energy?: number | null
          focus?: number | null
          id?: string
          journal_gratitude?: string | null
          journal_priority?: string | null
          journal_win?: string | null
          loop_metric_score?: number | null
          mood?: number | null
          training_day?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loop_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_logs: {
        Row: {
          card_id: string | null
          context: string | null
          created_at: string | null
          data: Json | null
          day: string | null
          id: string
          points: number | null
          user_id: string | null
        }
        Insert: {
          card_id?: string | null
          context?: string | null
          created_at?: string | null
          data?: Json | null
          day?: string | null
          id?: string
          points?: number | null
          user_id?: string | null
        }
        Update: {
          card_id?: string | null
          context?: string | null
          created_at?: string | null
          data?: Json | null
          day?: string | null
          id?: string
          points?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loop_logs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "loop_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loop_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "loop_users"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_reflections: {
        Row: {
          created_at: string | null
          day: string | null
          id: string
          intention: string | null
          meta_coach: string | null
          night_answer: string | null
          night_question: string | null
          reflection: string | null
          score: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          day?: string | null
          id?: string
          intention?: string | null
          meta_coach?: string | null
          night_answer?: string | null
          night_question?: string | null
          reflection?: string | null
          score?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          day?: string | null
          id?: string
          intention?: string | null
          meta_coach?: string | null
          night_answer?: string | null
          night_question?: string | null
          reflection?: string | null
          score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loop_reflections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "loop_users"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_users: {
        Row: {
          created_at: string
          day_count: number
          email: string
          id: string
          life_about: string | null
          loop_md: string | null
        }
        Insert: {
          created_at?: string
          day_count?: number
          email: string
          id?: string
          life_about?: string | null
          loop_md?: string | null
        }
        Update: {
          created_at?: string
          day_count?: number
          email?: string
          id?: string
          life_about?: string | null
          loop_md?: string | null
        }
        Relationships: []
      }
      module_executions: {
        Row: {
          confidence: number | null
          created_at: string | null
          error: string | null
          execution_time: string | null
          id: string
          input_data: Json | null
          latency_ms: number | null
          module_name: string
          output_data: Json | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          error?: string | null
          execution_time?: string | null
          id?: string
          input_data?: Json | null
          latency_ms?: number | null
          module_name: string
          output_data?: Json | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          error?: string | null
          execution_time?: string | null
          id?: string
          input_data?: Json | null
          latency_ms?: number | null
          module_name?: string
          output_data?: Json | null
        }
        Relationships: []
      }
      monthly_intelligence_reports: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          pdf_url: string | null
          period: string | null
          period_label: string | null
          report_data: Json | null
          report_month: string | null
          sent_at: string | null
          sent_to: string[] | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          period?: string | null
          period_label?: string | null
          report_data?: Json | null
          report_month?: string | null
          sent_at?: string | null
          sent_to?: string[] | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          period?: string | null
          period_label?: string | null
          report_data?: Json | null
          report_month?: string | null
          sent_at?: string | null
          sent_to?: string[] | null
        }
        Relationships: []
      }
      network_intelligence: {
        Row: {
          computed_at: string | null
          id: number
          metric_key: string
          metric_type: string
          metric_value: Json
          sample_size: number | null
        }
        Insert: {
          computed_at?: string | null
          id?: number
          metric_key: string
          metric_type: string
          metric_value: Json
          sample_size?: number | null
        }
        Update: {
          computed_at?: string | null
          id?: number
          metric_key?: string
          metric_type?: string
          metric_value?: Json
          sample_size?: number | null
        }
        Relationships: []
      }
      newsletter_issues: {
        Row: {
          html_content: string | null
          id: string
          open_count: number | null
          period: string | null
          sent_at: string | null
          sent_to_count: number | null
          subject: string | null
        }
        Insert: {
          html_content?: string | null
          id?: string
          open_count?: number | null
          period?: string | null
          sent_at?: string | null
          sent_to_count?: number | null
          subject?: string | null
        }
        Update: {
          html_content?: string | null
          id?: string
          open_count?: number | null
          period?: string | null
          sent_at?: string | null
          sent_to_count?: number | null
          subject?: string | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          active: boolean | null
          company: string | null
          email: string
          id: string
          last_sent: string | null
          name: string | null
          open_count: number | null
          role: string | null
          source: string | null
          subscribed_at: string | null
        }
        Insert: {
          active?: boolean | null
          company?: string | null
          email: string
          id?: string
          last_sent?: string | null
          name?: string | null
          open_count?: number | null
          role?: string | null
          source?: string | null
          subscribed_at?: string | null
        }
        Update: {
          active?: boolean | null
          company?: string | null
          email?: string
          id?: string
          last_sent?: string | null
          name?: string | null
          open_count?: number | null
          role?: string | null
          source?: string | null
          subscribed_at?: string | null
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          broker_id: string | null
          channel: string | null
          client_code: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          language: string | null
          recipient_email: string
          recipient_name: string | null
          resend_message_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_key: string
          template_vars: Json | null
          trafico_id: string | null
        }
        Insert: {
          broker_id?: string | null
          channel?: string | null
          client_code?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          language?: string | null
          recipient_email: string
          recipient_name?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_key: string
          template_vars?: Json | null
          trafico_id?: string | null
        }
        Update: {
          broker_id?: string | null
          channel?: string | null
          client_code?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          language?: string | null
          recipient_email?: string
          recipient_name?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_key?: string
          template_vars?: Json | null
          trafico_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          read: boolean | null
          severity: string | null
          title: string
          trafico_id: string | null
          type: string
        }
        Insert: {
          action_url?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          read?: boolean | null
          severity?: string | null
          title: string
          trafico_id?: string | null
          type: string
        }
        Update: {
          action_url?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          read?: boolean | null
          severity?: string | null
          title?: string
          trafico_id?: string | null
          type?: string
        }
        Relationships: []
      }
      oca_database: {
        Row: {
          alternative_fracciones: string[] | null
          approved_by: string | null
          company_id: string | null
          confidence: number | null
          created_at: string | null
          description: string | null
          fraccion: string | null
          id: string
          last_used: string | null
          legal_reasoning: string | null
          product_description: string | null
          source: string | null
          updated_at: string | null
          use_count: number | null
        }
        Insert: {
          alternative_fracciones?: string[] | null
          approved_by?: string | null
          company_id?: string | null
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          fraccion?: string | null
          id?: string
          last_used?: string | null
          legal_reasoning?: string | null
          product_description?: string | null
          source?: string | null
          updated_at?: string | null
          use_count?: number | null
        }
        Update: {
          alternative_fracciones?: string[] | null
          approved_by?: string | null
          company_id?: string | null
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          fraccion?: string | null
          id?: string
          last_used?: string | null
          legal_reasoning?: string | null
          product_description?: string | null
          source?: string | null
          updated_at?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      operational_decisions: {
        Row: {
          alternatives_considered: Json | null
          company_id: string | null
          created_at: string | null
          data_points_used: Json | null
          decision: string
          decision_type: string
          id: number
          lesson_learned: string | null
          outcome: string | null
          outcome_score: number | null
          reasoning: string | null
          resolved_at: string | null
          trafico: string | null
          was_optimal: boolean | null
        }
        Insert: {
          alternatives_considered?: Json | null
          company_id?: string | null
          created_at?: string | null
          data_points_used?: Json | null
          decision: string
          decision_type: string
          id?: number
          lesson_learned?: string | null
          outcome?: string | null
          outcome_score?: number | null
          reasoning?: string | null
          resolved_at?: string | null
          trafico?: string | null
          was_optimal?: boolean | null
        }
        Update: {
          alternatives_considered?: Json | null
          company_id?: string | null
          created_at?: string | null
          data_points_used?: Json | null
          decision?: string
          decision_type?: string
          id?: number
          lesson_learned?: string | null
          outcome?: string | null
          outcome_score?: number | null
          reasoning?: string | null
          resolved_at?: string | null
          trafico?: string | null
          was_optimal?: boolean | null
        }
        Relationships: []
      }
      operator_actions: {
        Row: {
          action_type: string
          company_id: string | null
          created_at: string
          duration_ms: number | null
          id: number
          ip_address: unknown
          operator_id: string
          payload: Json | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: number
          ip_address?: unknown
          operator_id: string
          payload?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: number
          ip_address?: unknown
          operator_id?: string
          payload?: Json | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_actions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          active: boolean
          auth_user_id: string
          company_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id: string
          company_id: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          role: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string
          company_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operators_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: true
            referencedRelation: "user_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      partidas: {
        Row: {
          cantidad_comercial: number | null
          cantidad_tarifa: number | null
          created_at: string
          descripcion: string | null
          fraccion_arancelaria: string | null
          id: number
          marca: string | null
          metodo_valoracion: string | null
          modelo: string | null
          pais_origen: string | null
          pais_vendedor: string | null
          partida_numero: number
          pedimento_id: string
          precio_unitario: number | null
          scraped_at: string
          unidad_comercial: string | null
          unidad_tarifa: string | null
          updated_at: string
          valor_aduana: number | null
          valor_dolares: number | null
          vinculacion: string | null
        }
        Insert: {
          cantidad_comercial?: number | null
          cantidad_tarifa?: number | null
          created_at?: string
          descripcion?: string | null
          fraccion_arancelaria?: string | null
          id?: number
          marca?: string | null
          metodo_valoracion?: string | null
          modelo?: string | null
          pais_origen?: string | null
          pais_vendedor?: string | null
          partida_numero: number
          pedimento_id: string
          precio_unitario?: number | null
          scraped_at?: string
          unidad_comercial?: string | null
          unidad_tarifa?: string | null
          updated_at?: string
          valor_aduana?: number | null
          valor_dolares?: number | null
          vinculacion?: string | null
        }
        Update: {
          cantidad_comercial?: number | null
          cantidad_tarifa?: number | null
          created_at?: string
          descripcion?: string | null
          fraccion_arancelaria?: string | null
          id?: number
          marca?: string | null
          metodo_valoracion?: string | null
          modelo?: string | null
          pais_origen?: string | null
          pais_vendedor?: string | null
          partida_numero?: number
          pedimento_id?: string
          precio_unitario?: number | null
          scraped_at?: string
          unidad_comercial?: string | null
          unidad_tarifa?: string | null
          updated_at?: string
          valor_aduana?: number | null
          valor_dolares?: number | null
          vinculacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partidas_pedimento_id_fkey"
            columns: ["pedimento_id"]
            isOneToOne: false
            referencedRelation: "pedimentos"
            referencedColumns: ["pedimento_id"]
          },
        ]
      }
      pcnet_trafico_detail: {
        Row: {
          cve: string
          error: string | null
          eventos: Json | null
          expediente_digital: Json | null
          facturas: Json | null
          header_info: Json | null
          id: string
          identificadores_partida: Json | null
          scraped_at: string | null
          stats: Json | null
        }
        Insert: {
          cve: string
          error?: string | null
          eventos?: Json | null
          expediente_digital?: Json | null
          facturas?: Json | null
          header_info?: Json | null
          id?: string
          identificadores_partida?: Json | null
          scraped_at?: string | null
          stats?: Json | null
        }
        Update: {
          cve?: string
          error?: string | null
          eventos?: Json | null
          expediente_digital?: Json | null
          facturas?: Json | null
          header_info?: Json | null
          id?: string
          identificadores_partida?: Json | null
          scraped_at?: string | null
          stats?: Json | null
        }
        Relationships: []
      }
      pedimento_drafts: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          draft_data: Json | null
          escalation_level: number | null
          id: string
          last_escalation_at: string | null
          needs_manual_intervention: boolean | null
          reviewed_by: string | null
          status: string | null
          trafico_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          draft_data?: Json | null
          escalation_level?: number | null
          id?: string
          last_escalation_at?: string | null
          needs_manual_intervention?: boolean | null
          reviewed_by?: string | null
          status?: string | null
          trafico_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          draft_data?: Json | null
          escalation_level?: number | null
          id?: string
          last_escalation_at?: string | null
          needs_manual_intervention?: boolean | null
          reviewed_by?: string | null
          status?: string | null
          trafico_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pedimento_risk_scores: {
        Row: {
          calculated_at: string | null
          carrier: string | null
          company_id: string | null
          confidence: number | null
          id: string
          overall_score: number | null
          recommendations: Json | null
          risk_factors: Json | null
          score: number | null
          trafico_id: string
          valor_usd: number | null
        }
        Insert: {
          calculated_at?: string | null
          carrier?: string | null
          company_id?: string | null
          confidence?: number | null
          id?: string
          overall_score?: number | null
          recommendations?: Json | null
          risk_factors?: Json | null
          score?: number | null
          trafico_id: string
          valor_usd?: number | null
        }
        Update: {
          calculated_at?: string | null
          carrier?: string | null
          company_id?: string | null
          confidence?: number | null
          id?: string
          overall_score?: number | null
          recommendations?: Json | null
          risk_factors?: Json | null
          score?: number | null
          trafico_id?: string
          valor_usd?: number | null
        }
        Relationships: []
      }
      pedimentos: {
        Row: {
          aduana: string | null
          clave_pedimento: string | null
          created_at: string
          estatus: string | null
          fecha_entrada: string | null
          fecha_pago: string | null
          id: number
          importe_total: number | null
          moneda: string | null
          numero_pedimento: string | null
          patente: string | null
          pedimento_id: string
          raw: Json | null
          rfc_importador: string | null
          scraped_at: string
          seccion_aduanera: string | null
          tipo_cambio: number | null
          tipo_operacion: string | null
          updated_at: string
          valor_aduana: number | null
        }
        Insert: {
          aduana?: string | null
          clave_pedimento?: string | null
          created_at?: string
          estatus?: string | null
          fecha_entrada?: string | null
          fecha_pago?: string | null
          id?: number
          importe_total?: number | null
          moneda?: string | null
          numero_pedimento?: string | null
          patente?: string | null
          pedimento_id: string
          raw?: Json | null
          rfc_importador?: string | null
          scraped_at?: string
          seccion_aduanera?: string | null
          tipo_cambio?: number | null
          tipo_operacion?: string | null
          updated_at?: string
          valor_aduana?: number | null
        }
        Update: {
          aduana?: string | null
          clave_pedimento?: string | null
          created_at?: string
          estatus?: string | null
          fecha_entrada?: string | null
          fecha_pago?: string | null
          id?: number
          importe_total?: number | null
          moneda?: string | null
          numero_pedimento?: string | null
          patente?: string | null
          pedimento_id?: string
          raw?: Json | null
          rfc_importador?: string | null
          scraped_at?: string
          seccion_aduanera?: string | null
          tipo_cambio?: number | null
          tipo_operacion?: string | null
          updated_at?: string
          valor_aduana?: number | null
        }
        Relationships: []
      }
      pedimentos_detalle: {
        Row: {
          anexo24_pedimento_id: number | null
          clave: string | null
          company_id: string | null
          created_at: string | null
          dta: number | null
          fecha_entrada: string | null
          fecha_pago: string | null
          fletes: number | null
          id: number
          igi: number | null
          iva: number | null
          num_coves: number | null
          num_partidas: number | null
          pedimento: string | null
          peso_kg: number | null
          prev: number | null
          regimen: string | null
          tipo_cambio: number | null
          total_factura_usd: number | null
          trafico: string
          usuario: string | null
          val_aduana_mn: number | null
          val_dolares: number | null
        }
        Insert: {
          anexo24_pedimento_id?: number | null
          clave?: string | null
          company_id?: string | null
          created_at?: string | null
          dta?: number | null
          fecha_entrada?: string | null
          fecha_pago?: string | null
          fletes?: number | null
          id?: number
          igi?: number | null
          iva?: number | null
          num_coves?: number | null
          num_partidas?: number | null
          pedimento?: string | null
          peso_kg?: number | null
          prev?: number | null
          regimen?: string | null
          tipo_cambio?: number | null
          total_factura_usd?: number | null
          trafico: string
          usuario?: string | null
          val_aduana_mn?: number | null
          val_dolares?: number | null
        }
        Update: {
          anexo24_pedimento_id?: number | null
          clave?: string | null
          company_id?: string | null
          created_at?: string | null
          dta?: number | null
          fecha_entrada?: string | null
          fecha_pago?: string | null
          fletes?: number | null
          id?: number
          igi?: number | null
          iva?: number | null
          num_coves?: number | null
          num_partidas?: number | null
          pedimento?: string | null
          peso_kg?: number | null
          prev?: number | null
          regimen?: string | null
          tipo_cambio?: number | null
          total_factura_usd?: number | null
          trafico?: string
          usuario?: string | null
          val_aduana_mn?: number | null
          val_dolares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedimentos_detalle_anexo24_pedimento_id_fkey"
            columns: ["anexo24_pedimento_id"]
            isOneToOne: false
            referencedRelation: "anexo24_pedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_signups: {
        Row: {
          aduana: string
          created_at: string
          email: string
          firm_name: string
          firm_slug: string
          full_name: string
          id: string
          patente: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          telefono: string | null
        }
        Insert: {
          aduana: string
          created_at?: string
          email: string
          firm_name: string
          firm_slug: string
          full_name: string
          id?: string
          patente: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          telefono?: string | null
        }
        Update: {
          aduana?: string
          created_at?: string
          email?: string
          firm_name?: string
          firm_slug?: string
          full_name?: string
          id?: string
          patente?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_signups_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_log: {
        Row: {
          company_id: string | null
          created_at: string | null
          details: Json | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_summary: string | null
          model_used: string | null
          output_summary: string | null
          pipeline_run_id: string | null
          status: string
          step: string
          timestamp: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: string | null
          model_used?: string | null
          output_summary?: string | null
          pipeline_run_id?: string | null
          status: string
          step: string
          timestamp?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_summary?: string | null
          model_used?: string | null
          output_summary?: string | null
          pipeline_run_id?: string | null
          status?: string
          step?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      pipeline_postmortems: {
        Row: {
          avg_pipeline_minutes: number | null
          bottleneck_step: string | null
          company_id: string | null
          created_at: string | null
          date: string | null
          first_pass_rate: number | null
          id: string
          patterns_detected: Json | null
          total_runs: number | null
        }
        Insert: {
          avg_pipeline_minutes?: number | null
          bottleneck_step?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          first_pass_rate?: number | null
          id?: string
          patterns_detected?: Json | null
          total_runs?: number | null
        }
        Update: {
          avg_pipeline_minutes?: number | null
          bottleneck_step?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string | null
          first_pass_rate?: number | null
          id?: string
          patterns_detected?: Json | null
          total_runs?: number | null
        }
        Relationships: []
      }
      po_prediction_accuracy: {
        Row: {
          actual_date: string | null
          actual_value_usd: number | null
          company_id: string
          created_at: string | null
          id: number
          overall_score: number | null
          predicted_date: string | null
          predicted_value_usd: number | null
          prediction_id: string | null
          product_match_pct: number | null
          supplier: string
          timing_error_days: number | null
          value_error_pct: number | null
        }
        Insert: {
          actual_date?: string | null
          actual_value_usd?: number | null
          company_id: string
          created_at?: string | null
          id?: number
          overall_score?: number | null
          predicted_date?: string | null
          predicted_value_usd?: number | null
          prediction_id?: string | null
          product_match_pct?: number | null
          supplier: string
          timing_error_days?: number | null
          value_error_pct?: number | null
        }
        Update: {
          actual_date?: string | null
          actual_value_usd?: number | null
          company_id?: string
          created_at?: string | null
          id?: number
          overall_score?: number | null
          predicted_date?: string | null
          predicted_value_usd?: number | null
          prediction_id?: string | null
          product_match_pct?: number | null
          supplier?: string
          timing_error_days?: number | null
          value_error_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "po_prediction_accuracy_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "po_predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      po_predictions: {
        Row: {
          actual_date: string | null
          actual_value_usd: number | null
          avg_frequency_days: number | null
          company_id: string
          confidence: number
          created_at: string | null
          estimated_duties: Json | null
          id: string
          last_shipment_date: string | null
          match_details: Json | null
          match_score: number | null
          matched_at: string | null
          matched_trafico: string | null
          optimal_crossing: Json | null
          predicted_date: string
          predicted_date_high: string | null
          predicted_date_low: string | null
          predicted_products: Json | null
          predicted_value_usd: number | null
          predicted_weight_kg: number | null
          sample_size: number
          status: string
          std_deviation_days: number | null
          supplier: string
          timing_error_days: number | null
          updated_at: string | null
          value_error_pct: number | null
          value_high_usd: number | null
          value_low_usd: number | null
        }
        Insert: {
          actual_date?: string | null
          actual_value_usd?: number | null
          avg_frequency_days?: number | null
          company_id: string
          confidence: number
          created_at?: string | null
          estimated_duties?: Json | null
          id?: string
          last_shipment_date?: string | null
          match_details?: Json | null
          match_score?: number | null
          matched_at?: string | null
          matched_trafico?: string | null
          optimal_crossing?: Json | null
          predicted_date: string
          predicted_date_high?: string | null
          predicted_date_low?: string | null
          predicted_products?: Json | null
          predicted_value_usd?: number | null
          predicted_weight_kg?: number | null
          sample_size: number
          status?: string
          std_deviation_days?: number | null
          supplier: string
          timing_error_days?: number | null
          updated_at?: string | null
          value_error_pct?: number | null
          value_high_usd?: number | null
          value_low_usd?: number | null
        }
        Update: {
          actual_date?: string | null
          actual_value_usd?: number | null
          avg_frequency_days?: number | null
          company_id?: string
          confidence?: number
          created_at?: string | null
          estimated_duties?: Json | null
          id?: string
          last_shipment_date?: string | null
          match_details?: Json | null
          match_score?: number | null
          matched_at?: string | null
          matched_trafico?: string | null
          optimal_crossing?: Json | null
          predicted_date?: string
          predicted_date_high?: string | null
          predicted_date_low?: string | null
          predicted_products?: Json | null
          predicted_value_usd?: number | null
          predicted_weight_kg?: number | null
          sample_size?: number
          status?: string
          std_deviation_days?: number | null
          supplier?: string
          timing_error_days?: number | null
          updated_at?: string | null
          value_error_pct?: number | null
          value_high_usd?: number | null
          value_low_usd?: number | null
        }
        Relationships: []
      }
      portal_audit_log: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          path: string | null
          query: string | null
          tenant_slug: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          path?: string | null
          query?: string | null
          tenant_slug?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          path?: string | null
          query?: string | null
          tenant_slug?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      portal_tokens: {
        Row: {
          active: boolean | null
          client_name: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          tenant_slug: string
          token: string
        }
        Insert: {
          active?: boolean | null
          client_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          tenant_slug: string
          token: string
        }
        Update: {
          active?: boolean | null
          client_name?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          tenant_slug?: string
          token?: string
        }
        Relationships: []
      }
      portfolio_benchmarks: {
        Row: {
          best_value: number | null
          bottom_quartile: number | null
          calculated_at: string | null
          fleet_average: number | null
          fleet_median: number | null
          id: string
          metric: string
          sample_size: number | null
          top_quartile: number | null
          worst_value: number | null
        }
        Insert: {
          best_value?: number | null
          bottom_quartile?: number | null
          calculated_at?: string | null
          fleet_average?: number | null
          fleet_median?: number | null
          id?: string
          metric: string
          sample_size?: number | null
          top_quartile?: number | null
          worst_value?: number | null
        }
        Update: {
          best_value?: number | null
          bottom_quartile?: number | null
          calculated_at?: string | null
          fleet_average?: number | null
          fleet_median?: number | null
          id?: string
          metric?: string
          sample_size?: number | null
          top_quartile?: number | null
          worst_value?: number | null
        }
        Relationships: []
      }
      pre_arrival_briefs: {
        Row: {
          brief_data: Json | null
          company_id: string | null
          created_at: string | null
          id: string
          sent_at: string | null
          trafico_id: string | null
        }
        Insert: {
          brief_data?: Json | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          sent_at?: string | null
          trafico_id?: string | null
        }
        Update: {
          brief_data?: Json | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          sent_at?: string | null
          trafico_id?: string | null
        }
        Relationships: []
      }
      processed_emails: {
        Row: {
          attachment_count: number | null
          body_text: string | null
          created_at: string | null
          draft_id: string | null
          email_id: string
          error_message: string | null
          from_address: string | null
          id: string
          processed_at: string | null
          status: string | null
          subject: string | null
          tenant_slug: string | null
          to_address: string | null
        }
        Insert: {
          attachment_count?: number | null
          body_text?: string | null
          created_at?: string | null
          draft_id?: string | null
          email_id: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_slug?: string | null
          to_address?: string | null
        }
        Update: {
          attachment_count?: number | null
          body_text?: string | null
          created_at?: string | null
          draft_id?: string | null
          email_id?: string
          error_message?: string | null
          from_address?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          subject?: string | null
          tenant_slug?: string | null
          to_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processed_emails_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_classifications: {
        Row: {
          avg_valor_unitario_usd: number | null
          company_id: string
          confidence: number
          created_at: string
          cve_cliente: string
          cve_producto: string
          cve_proveedor: string
          descripcion: string | null
          fraccion: string | null
          fraccion_display: string | null
          id: number
          igi: number | null
          last_classified_at: string
          last_verified_at: string | null
          pais_origen: string | null
          proveedor_nombre: string | null
          source: string
          source_count: number
          stddev_valor_unitario_usd: number | null
          tmec_eligible: boolean | null
          updated_at: string
          verified_by: string | null
        }
        Insert: {
          avg_valor_unitario_usd?: number | null
          company_id: string
          confidence: number
          created_at?: string
          cve_cliente: string
          cve_producto: string
          cve_proveedor: string
          descripcion?: string | null
          fraccion?: string | null
          fraccion_display?: string | null
          id?: number
          igi?: number | null
          last_classified_at?: string
          last_verified_at?: string | null
          pais_origen?: string | null
          proveedor_nombre?: string | null
          source: string
          source_count?: number
          stddev_valor_unitario_usd?: number | null
          tmec_eligible?: boolean | null
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          avg_valor_unitario_usd?: number | null
          company_id?: string
          confidence?: number
          created_at?: string
          cve_cliente?: string
          cve_producto?: string
          cve_proveedor?: string
          descripcion?: string | null
          fraccion?: string | null
          fraccion_display?: string | null
          id?: number
          igi?: number | null
          last_classified_at?: string
          last_verified_at?: string | null
          pais_origen?: string | null
          proveedor_nombre?: string | null
          source?: string
          source_count?: number
          stddev_valor_unitario_usd?: number | null
          tmec_eligible?: boolean | null
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: []
      }
      product_intelligence: {
        Row: {
          anomaly_flag: boolean | null
          avg_unit_price: number | null
          company_id: string | null
          descripcion: string | null
          fraccion: string | null
          id: string
          last_imported: string | null
          operation_count: number | null
          price_stddev: number | null
          price_trend: string | null
          supplier_count: number | null
          total_quantity: number | null
          total_value_usd: number | null
          updated_at: string | null
        }
        Insert: {
          anomaly_flag?: boolean | null
          avg_unit_price?: number | null
          company_id?: string | null
          descripcion?: string | null
          fraccion?: string | null
          id?: string
          last_imported?: string | null
          operation_count?: number | null
          price_stddev?: number | null
          price_trend?: string | null
          supplier_count?: number | null
          total_quantity?: number | null
          total_value_usd?: number | null
          updated_at?: string | null
        }
        Update: {
          anomaly_flag?: boolean | null
          avg_unit_price?: number | null
          company_id?: string | null
          descripcion?: string | null
          fraccion?: string | null
          id?: string
          last_imported?: string | null
          operation_count?: number | null
          price_stddev?: number | null
          price_trend?: string | null
          supplier_count?: number | null
          total_quantity?: number | null
          total_value_usd?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proposed_automations: {
        Row: {
          company_id: string | null
          confidence: number
          created_at: string
          evidence_count: number
          evidence_sample: Json | null
          expires_at: string
          id: string
          pattern_key: string
          pattern_type: string
          proposal: Json
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          company_id?: string | null
          confidence: number
          created_at?: string
          evidence_count?: number
          evidence_sample?: Json | null
          expires_at?: string
          id?: string
          pattern_key: string
          pattern_type: string
          proposal?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          company_id?: string | null
          confidence?: number
          created_at?: string
          evidence_count?: number
          evidence_sample?: Json | null
          expires_at?: string
          id?: string
          pattern_key?: string
          pattern_type?: string
          proposal?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          audit_data: Json | null
          company_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          converted_at: string | null
          converted_to_company_id: string | null
          created_at: string | null
          id: string
          next_action: string | null
          next_action_date: string | null
          rfc: string | null
          source: string | null
          status: string | null
        }
        Insert: {
          audit_data?: Json | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          converted_to_company_id?: string | null
          created_at?: string | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          rfc?: string | null
          source?: string | null
          status?: string | null
        }
        Update: {
          audit_data?: Json | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          converted_to_company_id?: string | null
          created_at?: string | null
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          rfc?: string | null
          source?: string | null
          status?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          company_id: string | null
          created_at: string | null
          endpoint: string | null
          id: string
          p256dh: string | null
        }
        Insert: {
          auth?: string | null
          company_id?: string | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          p256dh?: string | null
        }
        Update: {
          auth?: string | null
          company_id?: string | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          p256dh?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      rate_quotes: {
        Row: {
          company_id: string | null
          converted: boolean | null
          created_at: string | null
          declared_value_usd: number | null
          estimated_dta: number | null
          estimated_igi: number | null
          estimated_iva: number | null
          fraccion: string | null
          id: string
          product_description: string | null
          status: string | null
          tmec_applicable: boolean | null
          tmec_savings: number | null
        }
        Insert: {
          company_id?: string | null
          converted?: boolean | null
          created_at?: string | null
          declared_value_usd?: number | null
          estimated_dta?: number | null
          estimated_igi?: number | null
          estimated_iva?: number | null
          fraccion?: string | null
          id?: string
          product_description?: string | null
          status?: string | null
          tmec_applicable?: boolean | null
          tmec_savings?: number | null
        }
        Update: {
          company_id?: string | null
          converted?: boolean | null
          created_at?: string | null
          declared_value_usd?: number | null
          estimated_dta?: number | null
          estimated_igi?: number | null
          estimated_iva?: number | null
          fraccion?: string | null
          id?: string
          product_description?: string | null
          status?: string | null
          tmec_applicable?: boolean | null
          tmec_savings?: number | null
        }
        Relationships: []
      }
      rectificacion_opportunities: {
        Row: {
          company_id: string | null
          description: string | null
          fecha_pago: string | null
          id: string
          identified_at: string | null
          notes: string | null
          opportunity_type: string | null
          pedimento: string | null
          potential_recovery_mxn: number | null
          potential_recovery_usd: number | null
          status: string | null
          supplier: string | null
          trafico_id: string | null
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          fecha_pago?: string | null
          id?: string
          identified_at?: string | null
          notes?: string | null
          opportunity_type?: string | null
          pedimento?: string | null
          potential_recovery_mxn?: number | null
          potential_recovery_usd?: number | null
          status?: string | null
          supplier?: string | null
          trafico_id?: string | null
        }
        Update: {
          company_id?: string | null
          description?: string | null
          fecha_pago?: string | null
          id?: string
          identified_at?: string | null
          notes?: string | null
          opportunity_type?: string | null
          pedimento?: string | null
          potential_recovery_mxn?: number | null
          potential_recovery_usd?: number | null
          status?: string | null
          supplier?: string | null
          trafico_id?: string | null
        }
        Relationships: []
      }
      regression_guard_log: {
        Row: {
          alert_fired: boolean | null
          checked_at: string | null
          coverage_delta_pct: number | null
          coverage_pct: number | null
          details: Json | null
          id: number
          prev_coverage_pct: number | null
          prev_row_count: number | null
          row_count: number
          row_delta_pct: number | null
          table_name: string
          unmatched_count: number | null
        }
        Insert: {
          alert_fired?: boolean | null
          checked_at?: string | null
          coverage_delta_pct?: number | null
          coverage_pct?: number | null
          details?: Json | null
          id?: never
          prev_coverage_pct?: number | null
          prev_row_count?: number | null
          row_count: number
          row_delta_pct?: number | null
          table_name: string
          unmatched_count?: number | null
        }
        Update: {
          alert_fired?: boolean | null
          checked_at?: string | null
          coverage_delta_pct?: number | null
          coverage_pct?: number | null
          details?: Json | null
          id?: never
          prev_coverage_pct?: number | null
          prev_row_count?: number | null
          row_count?: number
          row_delta_pct?: number | null
          table_name?: string
          unmatched_count?: number | null
        }
        Relationships: []
      }
      regulatory_alerts: {
        Row: {
          affects_customs: boolean | null
          created_at: string | null
          id: string
          impact_summary: string | null
          processed_by: string | null
          published_date: string | null
          raw_content: string | null
          source: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          affects_customs?: boolean | null
          created_at?: string | null
          id?: string
          impact_summary?: string | null
          processed_by?: string | null
          published_date?: string | null
          raw_content?: string | null
          source?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          affects_customs?: boolean | null
          created_at?: string | null
          id?: string
          impact_summary?: string | null
          processed_by?: string | null
          published_date?: string | null
          raw_content?: string | null
          source?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      risk_history: {
        Row: {
          company_id: string
          id: string
          recorded_at: string | null
          risk_level: string
          trafico: string
        }
        Insert: {
          company_id: string
          id?: string
          recorded_at?: string | null
          risk_level: string
          trafico: string
        }
        Update: {
          company_id?: string
          id?: string
          recorded_at?: string | null
          risk_level?: string
          trafico?: string
        }
        Relationships: []
      }
      sandbox_results: {
        Row: {
          actual_dta: number | null
          actual_fraccion: string | null
          actual_igi: number | null
          actual_iva: number | null
          actual_tipo_cambio: number | null
          actual_tmec: boolean | null
          actual_total: number | null
          actual_valor_usd: number | null
          ai_cost_usd: number | null
          company_id: string
          created_at: string | null
          failure_reasons: string[] | null
          field_scores: Json
          ghost_dta: number | null
          ghost_fraccion: string | null
          ghost_igi: number | null
          ghost_iva: number | null
          ghost_tipo_cambio: number | null
          ghost_tmec: boolean | null
          ghost_total: number | null
          ghost_valor_usd: number | null
          id: string
          incomplete_fields: string[] | null
          latency_ms: number | null
          mode: string | null
          overall_score: number
          pass: boolean
          referencia: string
          run_id: string
          tokens_used: number | null
        }
        Insert: {
          actual_dta?: number | null
          actual_fraccion?: string | null
          actual_igi?: number | null
          actual_iva?: number | null
          actual_tipo_cambio?: number | null
          actual_tmec?: boolean | null
          actual_total?: number | null
          actual_valor_usd?: number | null
          ai_cost_usd?: number | null
          company_id: string
          created_at?: string | null
          failure_reasons?: string[] | null
          field_scores?: Json
          ghost_dta?: number | null
          ghost_fraccion?: string | null
          ghost_igi?: number | null
          ghost_iva?: number | null
          ghost_tipo_cambio?: number | null
          ghost_tmec?: boolean | null
          ghost_total?: number | null
          ghost_valor_usd?: number | null
          id?: string
          incomplete_fields?: string[] | null
          latency_ms?: number | null
          mode?: string | null
          overall_score?: number
          pass?: boolean
          referencia: string
          run_id: string
          tokens_used?: number | null
        }
        Update: {
          actual_dta?: number | null
          actual_fraccion?: string | null
          actual_igi?: number | null
          actual_iva?: number | null
          actual_tipo_cambio?: number | null
          actual_tmec?: boolean | null
          actual_total?: number | null
          actual_valor_usd?: number | null
          ai_cost_usd?: number | null
          company_id?: string
          created_at?: string | null
          failure_reasons?: string[] | null
          field_scores?: Json
          ghost_dta?: number | null
          ghost_fraccion?: string | null
          ghost_igi?: number | null
          ghost_iva?: number | null
          ghost_tipo_cambio?: number | null
          ghost_tmec?: boolean | null
          ghost_total?: number | null
          ghost_valor_usd?: number | null
          id?: string
          incomplete_fields?: string[] | null
          latency_ms?: number | null
          mode?: string | null
          overall_score?: number
          pass?: boolean
          referencia?: string
          run_id?: string
          tokens_used?: number | null
        }
        Relationships: []
      }
      scrape_runs: {
        Row: {
          coves_count: number | null
          duration_ms: number | null
          error_msg: string | null
          id: number
          pedimentos_count: number | null
          ran_at: string
          status: string
        }
        Insert: {
          coves_count?: number | null
          duration_ms?: number | null
          error_msg?: string | null
          id?: number
          pedimentos_count?: number | null
          ran_at?: string
          status: string
        }
        Update: {
          coves_count?: number | null
          duration_ms?: number | null
          error_msg?: string | null
          id?: number
          pedimentos_count?: number | null
          ran_at?: string
          status?: string
        }
        Relationships: []
      }
      self_healing_log: {
        Row: {
          action_taken: string | null
          created_at: string | null
          description: string | null
          details: Json | null
          detected_at: string | null
          heal_duration_ms: number | null
          healed: boolean | null
          id: number
          issue_type: string
          manual_required: boolean | null
          severity: string | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          description?: string | null
          details?: Json | null
          detected_at?: string | null
          heal_duration_ms?: number | null
          healed?: boolean | null
          id?: number
          issue_type: string
          manual_required?: boolean | null
          severity?: string | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          description?: string | null
          details?: Json | null
          detected_at?: string | null
          heal_duration_ms?: number | null
          healed?: boolean | null
          id?: number
          issue_type?: string
          manual_required?: boolean | null
          severity?: string | null
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          request_type: string | null
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          request_type?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          request_type?: string | null
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      shadow_classifications: {
        Row: {
          accuracy: number | null
          classification: string | null
          confidence: number | null
          created_at: string | null
          email_id: string | null
          from_address: string | null
          id: number
          matched_at: string | null
          sonnet_response: Json | null
          staff_action: string | null
          subject: string | null
        }
        Insert: {
          accuracy?: number | null
          classification?: string | null
          confidence?: number | null
          created_at?: string | null
          email_id?: string | null
          from_address?: string | null
          id?: number
          matched_at?: string | null
          sonnet_response?: Json | null
          staff_action?: string | null
          subject?: string | null
        }
        Update: {
          accuracy?: number | null
          classification?: string | null
          confidence?: number | null
          created_at?: string | null
          email_id?: string | null
          from_address?: string | null
          id?: number
          matched_at?: string | null
          sonnet_response?: Json | null
          staff_action?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      shadow_emails: {
        Row: {
          account: string
          action_type: string | null
          attachment_names: string[] | null
          confidence: number | null
          created_at: string | null
          gmail_message_id: string
          id: number
          ollama_raw: Json | null
          received_at: string | null
          recipient: string | null
          sender: string | null
          snippet: string | null
          subject: string | null
          trafico_ref: string | null
          workflow_stage: string | null
        }
        Insert: {
          account: string
          action_type?: string | null
          attachment_names?: string[] | null
          confidence?: number | null
          created_at?: string | null
          gmail_message_id: string
          id?: never
          ollama_raw?: Json | null
          received_at?: string | null
          recipient?: string | null
          sender?: string | null
          snippet?: string | null
          subject?: string | null
          trafico_ref?: string | null
          workflow_stage?: string | null
        }
        Update: {
          account?: string
          action_type?: string | null
          attachment_names?: string[] | null
          confidence?: number | null
          created_at?: string | null
          gmail_message_id?: string
          id?: never
          ollama_raw?: Json | null
          received_at?: string | null
          recipient?: string | null
          sender?: string | null
          snippet?: string | null
          subject?: string | null
          trafico_ref?: string | null
          workflow_stage?: string | null
        }
        Relationships: []
      }
      shadow_training_log: {
        Row: {
          accepted_without_revision: boolean | null
          account: string
          actual_outcome: string | null
          completed: boolean | null
          completion_ms: number | null
          context_summary: string | null
          corrections_content: string | null
          corrections_count: number | null
          created_at: string | null
          cruz_draft: string | null
          email_id: string | null
          id: string
          score_overall: number | null
          tito_correction: boolean | null
          used_as_training: boolean | null
        }
        Insert: {
          accepted_without_revision?: boolean | null
          account: string
          actual_outcome?: string | null
          completed?: boolean | null
          completion_ms?: number | null
          context_summary?: string | null
          corrections_content?: string | null
          corrections_count?: number | null
          created_at?: string | null
          cruz_draft?: string | null
          email_id?: string | null
          id?: string
          score_overall?: number | null
          tito_correction?: boolean | null
          used_as_training?: boolean | null
        }
        Update: {
          accepted_without_revision?: boolean | null
          account?: string
          actual_outcome?: string | null
          completed?: boolean | null
          completion_ms?: number | null
          context_summary?: string | null
          corrections_content?: string | null
          corrections_count?: number | null
          created_at?: string | null
          cruz_draft?: string | null
          email_id?: string | null
          id?: string
          score_overall?: number | null
          tito_correction?: boolean | null
          used_as_training?: boolean | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          client_id: string | null
          created_at: string | null
          destination: string | null
          eta: string | null
          hs_code: string | null
          id: string
          mx_pedimento_number: string | null
          origin: string | null
          reference_number: string | null
          status: string | null
          us_entry_number: string | null
          value: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          destination?: string | null
          eta?: string | null
          hs_code?: string | null
          id?: string
          mx_pedimento_number?: string | null
          origin?: string | null
          reference_number?: string | null
          status?: string | null
          us_entry_number?: string | null
          value?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          destination?: string | null
          eta?: string | null
          hs_code?: string | null
          id?: string
          mx_pedimento_number?: string | null
          origin?: string | null
          reference_number?: string | null
          status?: string | null
          us_entry_number?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      soia_cruces: {
        Row: {
          banco: string | null
          created_at: string | null
          estado: string
          factura: string | null
          fecha: string | null
          id: string
          num_operacion: string | null
          pedimento: string
          secuencia: string | null
          trafico: string
        }
        Insert: {
          banco?: string | null
          created_at?: string | null
          estado: string
          factura?: string | null
          fecha?: string | null
          id?: string
          num_operacion?: string | null
          pedimento: string
          secuencia?: string | null
          trafico: string
        }
        Update: {
          banco?: string | null
          created_at?: string | null
          estado?: string
          factura?: string | null
          fecha?: string | null
          id?: string
          num_operacion?: string | null
          pedimento?: string
          secuencia?: string | null
          trafico?: string
        }
        Relationships: []
      }
      soia_payment_status: {
        Row: {
          aduana_codigo: string | null
          año: number | null
          banco: string | null
          error: string | null
          estado: string | null
          estado_linea: string | null
          fecha_cruce: string | null
          fecha_pago_saai: string | null
          id: number
          importe: number | null
          linea_captura: string | null
          num_operacion: string | null
          pedimento: string
          scraped_at: string | null
          short_pedimento: string | null
        }
        Insert: {
          aduana_codigo?: string | null
          año?: number | null
          banco?: string | null
          error?: string | null
          estado?: string | null
          estado_linea?: string | null
          fecha_cruce?: string | null
          fecha_pago_saai?: string | null
          id?: number
          importe?: number | null
          linea_captura?: string | null
          num_operacion?: string | null
          pedimento: string
          scraped_at?: string | null
          short_pedimento?: string | null
        }
        Update: {
          aduana_codigo?: string | null
          año?: number | null
          banco?: string | null
          error?: string | null
          estado?: string | null
          estado_linea?: string | null
          fecha_cruce?: string | null
          fecha_pago_saai?: string | null
          id?: number
          importe?: number | null
          linea_captura?: string | null
          num_operacion?: string | null
          pedimento?: string
          scraped_at?: string | null
          short_pedimento?: string | null
        }
        Relationships: []
      }
      staff_corrections: {
        Row: {
          context: Json | null
          corrected_by: string | null
          corrected_value: string | null
          correction_type: string | null
          created_at: string | null
          id: number
          original_value: string | null
          trafico: string | null
        }
        Insert: {
          context?: Json | null
          corrected_by?: string | null
          corrected_value?: string | null
          correction_type?: string | null
          created_at?: string | null
          id?: number
          original_value?: string | null
          trafico?: string | null
        }
        Update: {
          context?: Json | null
          corrected_by?: string | null
          corrected_value?: string | null
          correction_type?: string | null
          created_at?: string | null
          id?: number
          original_value?: string | null
          trafico?: string | null
        }
        Relationships: []
      }
      staged_traficos: {
        Row: {
          carrier_alert_draft: string | null
          company_id: string
          created_at: string | null
          descripcion_mercancia: string | null
          estimated_duties: Json | null
          id: string
          importe_total: number | null
          peso_bruto: number | null
          po_prediction_id: string | null
          productos: Json | null
          promoted_at: string | null
          promoted_by: string | null
          promoted_trafico_id: string | null
          recommended_crossing: Json | null
          status: string
          supplier: string | null
          supplier_notification_draft: string | null
          updated_at: string | null
        }
        Insert: {
          carrier_alert_draft?: string | null
          company_id: string
          created_at?: string | null
          descripcion_mercancia?: string | null
          estimated_duties?: Json | null
          id?: string
          importe_total?: number | null
          peso_bruto?: number | null
          po_prediction_id?: string | null
          productos?: Json | null
          promoted_at?: string | null
          promoted_by?: string | null
          promoted_trafico_id?: string | null
          recommended_crossing?: Json | null
          status?: string
          supplier?: string | null
          supplier_notification_draft?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier_alert_draft?: string | null
          company_id?: string
          created_at?: string | null
          descripcion_mercancia?: string | null
          estimated_duties?: Json | null
          id?: string
          importe_total?: number | null
          peso_bruto?: number | null
          po_prediction_id?: string | null
          productos?: Json | null
          promoted_at?: string | null
          promoted_by?: string | null
          promoted_trafico_id?: string | null
          recommended_crossing?: Json | null
          status?: string
          supplier?: string | null
          supplier_notification_draft?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staged_traficos_po_prediction_id_fkey"
            columns: ["po_prediction_id"]
            isOneToOne: false
            referencedRelation: "po_predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contacts: {
        Row: {
          certificate_expiry: string | null
          certificate_type: string | null
          company_id: string | null
          created_at: string | null
          id: string
          proveedor: string | null
          recommendation: string | null
          risk_factors: Json | null
          risk_score: number | null
          risk_scored_at: string | null
          tmec_consistency: string | null
          whatsapp_number: string | null
          whatsapp_verified: boolean | null
        }
        Insert: {
          certificate_expiry?: string | null
          certificate_type?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          proveedor?: string | null
          recommendation?: string | null
          risk_factors?: Json | null
          risk_score?: number | null
          risk_scored_at?: string | null
          tmec_consistency?: string | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
        }
        Update: {
          certificate_expiry?: string | null
          certificate_type?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          proveedor?: string | null
          recommendation?: string | null
          risk_factors?: Json | null
          risk_score?: number | null
          risk_scored_at?: string | null
          tmec_consistency?: string | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
        }
        Relationships: []
      }
      supplier_intelligence: {
        Row: {
          avg_crossing_hours: number | null
          avg_shipment_value: number | null
          company_id: string
          id: string
          last_analyzed: string | null
          status_distribution: Json | null
          supplier_name: string
          total_ops: number | null
        }
        Insert: {
          avg_crossing_hours?: number | null
          avg_shipment_value?: number | null
          company_id?: string
          id?: string
          last_analyzed?: string | null
          status_distribution?: Json | null
          supplier_name: string
          total_ops?: number | null
        }
        Update: {
          avg_crossing_hours?: number | null
          avg_shipment_value?: number | null
          company_id?: string
          id?: string
          last_analyzed?: string | null
          status_distribution?: Json | null
          supplier_name?: string
          total_ops?: number | null
        }
        Relationships: []
      }
      supplier_network: {
        Row: {
          avg_value_usd: number | null
          company_id: string | null
          created_at: string | null
          id: string
          incident_rate: number | null
          last_seen: string | null
          reliability_score: number | null
          seen_by_clients: string[] | null
          supplier_country: string | null
          supplier_name: string | null
          supplier_name_normalized: string | null
          tmec_eligible: boolean | null
          total_operations: number | null
          typical_fracciones: string[] | null
          updated_at: string | null
          value_volatility: number | null
        }
        Insert: {
          avg_value_usd?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          incident_rate?: number | null
          last_seen?: string | null
          reliability_score?: number | null
          seen_by_clients?: string[] | null
          supplier_country?: string | null
          supplier_name?: string | null
          supplier_name_normalized?: string | null
          tmec_eligible?: boolean | null
          total_operations?: number | null
          typical_fracciones?: string[] | null
          updated_at?: string | null
          value_volatility?: number | null
        }
        Update: {
          avg_value_usd?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          incident_rate?: number | null
          last_seen?: string | null
          reliability_score?: number | null
          seen_by_clients?: string[] | null
          supplier_country?: string | null
          supplier_name?: string | null
          supplier_name_normalized?: string | null
          tmec_eligible?: boolean | null
          total_operations?: number | null
          typical_fracciones?: string[] | null
          updated_at?: string | null
          value_volatility?: number | null
        }
        Relationships: []
      }
      supplier_profiles: {
        Row: {
          aduanas_used: Json
          avg_days_between_shipments: number | null
          avg_peso_kg: number | null
          avg_valor_aduana_mxn: number | null
          avg_valor_per_kg_mxn: number | null
          carriers_used: Json
          client_code: string
          computed_at: string
          confidence: string
          days_active: number | null
          first_seen_at: string | null
          fraccion_diversity: number | null
          fracciones_used: Json
          id: number
          last_seen_at: string | null
          max_valor_aduana_mxn: number | null
          median_peso_kg: number | null
          median_valor_aduana_mxn: number | null
          min_valor_aduana_mxn: number | null
          monthly_distribution: number[] | null
          primary_aduana: string | null
          primary_carrier: string | null
          primary_carrier_pct: number | null
          primary_fraccion: string | null
          primary_fraccion_pct: number | null
          proveedor: string
          proveedor_raw_variants: string[] | null
          source_traficos_count: number
          stddev_peso_kg: number | null
          stddev_valor_aduana_mxn: number | null
          stddev_valor_per_kg_mxn: number | null
          tmec_eligible_pct: number | null
          total_traficos: number
        }
        Insert: {
          aduanas_used?: Json
          avg_days_between_shipments?: number | null
          avg_peso_kg?: number | null
          avg_valor_aduana_mxn?: number | null
          avg_valor_per_kg_mxn?: number | null
          carriers_used?: Json
          client_code: string
          computed_at?: string
          confidence: string
          days_active?: number | null
          first_seen_at?: string | null
          fraccion_diversity?: number | null
          fracciones_used?: Json
          id?: number
          last_seen_at?: string | null
          max_valor_aduana_mxn?: number | null
          median_peso_kg?: number | null
          median_valor_aduana_mxn?: number | null
          min_valor_aduana_mxn?: number | null
          monthly_distribution?: number[] | null
          primary_aduana?: string | null
          primary_carrier?: string | null
          primary_carrier_pct?: number | null
          primary_fraccion?: string | null
          primary_fraccion_pct?: number | null
          proveedor: string
          proveedor_raw_variants?: string[] | null
          source_traficos_count: number
          stddev_peso_kg?: number | null
          stddev_valor_aduana_mxn?: number | null
          stddev_valor_per_kg_mxn?: number | null
          tmec_eligible_pct?: number | null
          total_traficos?: number
        }
        Update: {
          aduanas_used?: Json
          avg_days_between_shipments?: number | null
          avg_peso_kg?: number | null
          avg_valor_aduana_mxn?: number | null
          avg_valor_per_kg_mxn?: number | null
          carriers_used?: Json
          client_code?: string
          computed_at?: string
          confidence?: string
          days_active?: number | null
          first_seen_at?: string | null
          fraccion_diversity?: number | null
          fracciones_used?: Json
          id?: number
          last_seen_at?: string | null
          max_valor_aduana_mxn?: number | null
          median_peso_kg?: number | null
          median_valor_aduana_mxn?: number | null
          min_valor_aduana_mxn?: number | null
          monthly_distribution?: number[] | null
          primary_aduana?: string | null
          primary_carrier?: string | null
          primary_carrier_pct?: number | null
          primary_fraccion?: string | null
          primary_fraccion_pct?: number | null
          proveedor?: string
          proveedor_raw_variants?: string[] | null
          source_traficos_count?: number
          stddev_peso_kg?: number | null
          stddev_valor_aduana_mxn?: number | null
          stddev_valor_per_kg_mxn?: number | null
          tmec_eligible_pct?: number | null
          total_traficos?: number
        }
        Relationships: []
      }
      supplier_referrals: {
        Row: {
          action: string
          client_company_id: string | null
          created_at: string | null
          id: number
          metadata: Json | null
          source_token: string | null
          supplier_company: string | null
          supplier_name: string | null
        }
        Insert: {
          action: string
          client_company_id?: string | null
          created_at?: string | null
          id?: number
          metadata?: Json | null
          source_token?: string | null
          supplier_company?: string | null
          supplier_name?: string | null
        }
        Update: {
          action?: string
          client_company_id?: string | null
          created_at?: string | null
          id?: number
          metadata?: Json | null
          source_token?: string | null
          supplier_company?: string | null
          supplier_name?: string | null
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          company_id: string | null
          completed_at: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          rows_synced: number | null
          started_at: string | null
          status: string | null
          sync_type: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          rows_synced?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          rows_synced?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          key: string
          notes: string | null
          updated_at: string | null
          valid_from: string
          valid_to: string | null
          value: Json
        }
        Insert: {
          key: string
          notes?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_to?: string | null
          value: Json
        }
        Update: {
          key?: string
          notes?: string | null
          updated_at?: string | null
          valid_from?: string
          valid_to?: string | null
          value?: Json
        }
        Relationships: []
      }
      tariff_rates: {
        Row: {
          fraccion: string
          igi_rate: number
          sample_count: number | null
          source: string
          updated_at: string | null
          valid_from: string | null
        }
        Insert: {
          fraccion: string
          igi_rate?: number
          sample_count?: number | null
          source?: string
          updated_at?: string | null
          valid_from?: string | null
        }
        Update: {
          fraccion?: string
          igi_rate?: number
          sample_count?: number | null
          source?: string
          updated_at?: string | null
          valid_from?: string | null
        }
        Relationships: []
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          role: string
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          id: string
          invited_by: string | null
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          max_users: number | null
          name: string
          plan: string
          rfc: string | null
          settings: Json | null
          slug: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_users?: number | null
          name: string
          plan?: string
          rfc?: string | null
          settings?: Json | null
          slug: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_users?: number | null
          name?: string
          plan?: string
          rfc?: string | null
          settings?: Json | null
          slug?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tigie_fracciones: {
        Row: {
          arancel_mfn: number | null
          arancel_usmca: number | null
          chapter: string | null
          chapter_desc: string | null
          created_at: string | null
          descripcion: string | null
          descripcion_comercial: string | null
          fraccion: string
          frequency_garz: number | null
          id: string
          position: string | null
          source: string | null
          subposition: string | null
          unidad: string | null
          verified: boolean | null
        }
        Insert: {
          arancel_mfn?: number | null
          arancel_usmca?: number | null
          chapter?: string | null
          chapter_desc?: string | null
          created_at?: string | null
          descripcion?: string | null
          descripcion_comercial?: string | null
          fraccion: string
          frequency_garz?: number | null
          id?: string
          position?: string | null
          source?: string | null
          subposition?: string | null
          unidad?: string | null
          verified?: boolean | null
        }
        Update: {
          arancel_mfn?: number | null
          arancel_usmca?: number | null
          chapter?: string | null
          chapter_desc?: string | null
          created_at?: string | null
          descripcion?: string | null
          descripcion_comercial?: string | null
          fraccion?: string
          frequency_garz?: number | null
          id?: string
          position?: string | null
          source?: string | null
          subposition?: string | null
          unidad?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      time_log: {
        Row: {
          activity: string | null
          category: string | null
          date: string | null
          generated_value: string | null
          hours: number | null
          id: string
          should_automate: boolean | null
        }
        Insert: {
          activity?: string | null
          category?: string | null
          date?: string | null
          generated_value?: string | null
          hours?: number | null
          id?: string
          should_automate?: boolean | null
        }
        Update: {
          activity?: string | null
          category?: string | null
          date?: string | null
          generated_value?: string | null
          hours?: number | null
          id?: string
          should_automate?: boolean | null
        }
        Relationships: []
      }
      tracking_tokens: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          token: string
          trafico_id: string
          view_count: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          token?: string
          trafico_id: string
          view_count?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          token?: string
          trafico_id?: string
          view_count?: number | null
        }
        Relationships: []
      }
      trafico_completeness: {
        Row: {
          blocking_count: number | null
          blocking_docs: Json | null
          broker_id: string | null
          can_cross: boolean | null
          can_file: boolean | null
          created_at: string | null
          docs_present: number | null
          docs_required: number | null
          docs_verified: number | null
          id: string
          last_calculated_at: string | null
          score: number | null
          trafico_id: string
          updated_at: string | null
          warning_count: number | null
          warning_docs: Json | null
        }
        Insert: {
          blocking_count?: number | null
          blocking_docs?: Json | null
          broker_id?: string | null
          can_cross?: boolean | null
          can_file?: boolean | null
          created_at?: string | null
          docs_present?: number | null
          docs_required?: number | null
          docs_verified?: number | null
          id?: string
          last_calculated_at?: string | null
          score?: number | null
          trafico_id: string
          updated_at?: string | null
          warning_count?: number | null
          warning_docs?: Json | null
        }
        Update: {
          blocking_count?: number | null
          blocking_docs?: Json | null
          broker_id?: string | null
          can_cross?: boolean | null
          can_file?: boolean | null
          created_at?: string | null
          docs_present?: number | null
          docs_required?: number | null
          docs_verified?: number | null
          id?: string
          last_calculated_at?: string | null
          score?: number | null
          trafico_id?: string
          updated_at?: string | null
          warning_count?: number | null
          warning_docs?: Json | null
        }
        Relationships: []
      }
      trafico_timeline: {
        Row: {
          content: string
          content_es: string | null
          created_at: string | null
          created_by: string | null
          event_type: string
          id: string
          metadata: Json | null
          severity: string | null
          source: string | null
          trafico_id: string
        }
        Insert: {
          content: string
          content_es?: string | null
          created_at?: string | null
          created_by?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          severity?: string | null
          source?: string | null
          trafico_id: string
        }
        Update: {
          content?: string
          content_es?: string | null
          created_at?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          severity?: string | null
          source?: string | null
          trafico_id?: string
        }
        Relationships: []
      }
      traficos: {
        Row: {
          aduana: string | null
          assigned_to_operator_id: string | null
          broker_id: string | null
          bultos_recibidos: number | null
          client_id: string | null
          company_id: string | null
          contenedor: string | null
          created_at: string | null
          descripcion_mercancia: string | null
          embarque: string | null
          estatus: string | null
          facturas: string | null
          fecha_cruce: string | null
          fecha_llegada: string | null
          fecha_pago: string | null
          id: number
          importe_total: number | null
          oficina: string | null
          pais_procedencia: string | null
          patente: string | null
          pedimento: string | null
          peso_bruto: number | null
          peso_bruto_unidad: number | null
          predicted_at: string | null
          predicted_fraccion: string | null
          predicted_igi: number | null
          predicted_landed_cost: number | null
          predicted_tmec: boolean | null
          prediction_confidence: number | null
          proveedores: string | null
          referencia_cliente: string | null
          regimen: string | null
          score_reasons: string | null
          semaforo: number | null
          tenant_id: string
          tenant_slug: string | null
          tipo_cambio: number | null
          trafico: string | null
          transportista_extranjero: string | null
          transportista_mexicano: string | null
          updated_at: string | null
        }
        Insert: {
          aduana?: string | null
          assigned_to_operator_id?: string | null
          broker_id?: string | null
          bultos_recibidos?: number | null
          client_id?: string | null
          company_id?: string | null
          contenedor?: string | null
          created_at?: string | null
          descripcion_mercancia?: string | null
          embarque?: string | null
          estatus?: string | null
          facturas?: string | null
          fecha_cruce?: string | null
          fecha_llegada?: string | null
          fecha_pago?: string | null
          id?: number
          importe_total?: number | null
          oficina?: string | null
          pais_procedencia?: string | null
          patente?: string | null
          pedimento?: string | null
          peso_bruto?: number | null
          peso_bruto_unidad?: number | null
          predicted_at?: string | null
          predicted_fraccion?: string | null
          predicted_igi?: number | null
          predicted_landed_cost?: number | null
          predicted_tmec?: boolean | null
          prediction_confidence?: number | null
          proveedores?: string | null
          referencia_cliente?: string | null
          regimen?: string | null
          score_reasons?: string | null
          semaforo?: number | null
          tenant_id: string
          tenant_slug?: string | null
          tipo_cambio?: number | null
          trafico?: string | null
          transportista_extranjero?: string | null
          transportista_mexicano?: string | null
          updated_at?: string | null
        }
        Update: {
          aduana?: string | null
          assigned_to_operator_id?: string | null
          broker_id?: string | null
          bultos_recibidos?: number | null
          client_id?: string | null
          company_id?: string | null
          contenedor?: string | null
          created_at?: string | null
          descripcion_mercancia?: string | null
          embarque?: string | null
          estatus?: string | null
          facturas?: string | null
          fecha_cruce?: string | null
          fecha_llegada?: string | null
          fecha_pago?: string | null
          id?: number
          importe_total?: number | null
          oficina?: string | null
          pais_procedencia?: string | null
          patente?: string | null
          pedimento?: string | null
          peso_bruto?: number | null
          peso_bruto_unidad?: number | null
          predicted_at?: string | null
          predicted_fraccion?: string | null
          predicted_igi?: number | null
          predicted_landed_cost?: number | null
          predicted_tmec?: boolean | null
          prediction_confidence?: number | null
          proveedores?: string | null
          referencia_cliente?: string | null
          regimen?: string | null
          score_reasons?: string | null
          semaforo?: number | null
          tenant_id?: string
          tenant_slug?: string | null
          tipo_cambio?: number | null
          trafico?: string | null
          transportista_extranjero?: string | null
          transportista_mexicano?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traficos_assigned_to_operator_id_fkey"
            columns: ["assigned_to_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traficos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_tokens: {
        Row: {
          company_id: string
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          docs_received: string[] | null
          expires_at: string
          id: string
          required_docs: string[] | null
          solicitud_ids: string[] | null
          token: string
          trafico_id: string
          view_count: number | null
        }
        Insert: {
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          docs_received?: string[] | null
          expires_at?: string
          id?: string
          required_docs?: string[] | null
          solicitud_ids?: string[] | null
          token?: string
          trafico_id: string
          view_count?: number | null
        }
        Update: {
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          docs_received?: string[] | null
          expires_at?: string
          id?: string
          required_docs?: string[] | null
          solicitud_ids?: string[] | null
          token?: string
          trafico_id?: string
          view_count?: number | null
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          answer: string | null
          company_id: string
          context: string | null
          created_at: string | null
          id: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          company_id: string
          context?: string | null
          created_at?: string | null
          id?: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          company_id?: string
          context?: string | null
          created_at?: string | null
          id?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          company_id: string | null
          created_at: string | null
          dark_mode: boolean | null
          default_filter: string | null
          default_sort: string | null
          default_sort_dir: string | null
          id: string
          items_per_page: number | null
          notifications_enabled: boolean | null
          preferred_language: string | null
          updated_at: string | null
          user_identifier: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          dark_mode?: boolean | null
          default_filter?: string | null
          default_sort?: string | null
          default_sort_dir?: string | null
          id?: string
          items_per_page?: number | null
          notifications_enabled?: boolean | null
          preferred_language?: string | null
          updated_at?: string | null
          user_identifier?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          dark_mode?: boolean | null
          default_filter?: string | null
          default_sort?: string | null
          default_sort_dir?: string | null
          id?: string
          items_per_page?: number | null
          notifications_enabled?: boolean | null
          preferred_language?: string | null
          updated_at?: string | null
          user_identifier?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          bot_token: string | null
          created_at: string | null
          id: string
          name: string | null
          onboarded_at: string | null
          stripe_customer_id: string | null
          telegram_id: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          bot_token?: string | null
          created_at?: string | null
          id: string
          name?: string | null
          onboarded_at?: string | null
          stripe_customer_id?: string | null
          telegram_id?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          bot_token?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          onboarded_at?: string | null
          stripe_customer_id?: string | null
          telegram_id?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          ante_amount: number | null
          archetype: string | null
          bluntness: number | null
          chip_count: number | null
          created_at: string | null
          current_loop_day: number | null
          current_loop_metric: string | null
          current_loop_text: string | null
          current_pre_auth_id: string | null
          current_streak: number | null
          drain: string | null
          energy_baseline: number | null
          evening_time: string | null
          id: string
          identity: string | null
          level: string | null
          longest_streak: number | null
          mode: string | null
          nutrition_baseline: number | null
          onboarding_complete: boolean | null
          onboarding_step: number | null
          output_baseline: string | null
          plan_text: string | null
          protocols: string | null
          sleep_time: string | null
          stripe_customer_id: string | null
          telegram_id: number
          telegram_username: string | null
          timezone: string | null
          total_folds: number | null
          total_hands: number | null
          training_baseline: string | null
          updated_at: string | null
          wake_time: string | null
        }
        Insert: {
          ante_amount?: number | null
          archetype?: string | null
          bluntness?: number | null
          chip_count?: number | null
          created_at?: string | null
          current_loop_day?: number | null
          current_loop_metric?: string | null
          current_loop_text?: string | null
          current_pre_auth_id?: string | null
          current_streak?: number | null
          drain?: string | null
          energy_baseline?: number | null
          evening_time?: string | null
          id?: string
          identity?: string | null
          level?: string | null
          longest_streak?: number | null
          mode?: string | null
          nutrition_baseline?: number | null
          onboarding_complete?: boolean | null
          onboarding_step?: number | null
          output_baseline?: string | null
          plan_text?: string | null
          protocols?: string | null
          sleep_time?: string | null
          stripe_customer_id?: string | null
          telegram_id: number
          telegram_username?: string | null
          timezone?: string | null
          total_folds?: number | null
          total_hands?: number | null
          training_baseline?: string | null
          updated_at?: string | null
          wake_time?: string | null
        }
        Update: {
          ante_amount?: number | null
          archetype?: string | null
          bluntness?: number | null
          chip_count?: number | null
          created_at?: string | null
          current_loop_day?: number | null
          current_loop_metric?: string | null
          current_loop_text?: string | null
          current_pre_auth_id?: string | null
          current_streak?: number | null
          drain?: string | null
          energy_baseline?: number | null
          evening_time?: string | null
          id?: string
          identity?: string | null
          level?: string | null
          longest_streak?: number | null
          mode?: string | null
          nutrition_baseline?: number | null
          onboarding_complete?: boolean | null
          onboarding_step?: number | null
          output_baseline?: string | null
          plan_text?: string | null
          protocols?: string | null
          sleep_time?: string | null
          stripe_customer_id?: string | null
          telegram_id?: number
          telegram_username?: string | null
          timezone?: string | null
          total_folds?: number | null
          total_hands?: number | null
          training_baseline?: string | null
          updated_at?: string | null
          wake_time?: string | null
        }
        Relationships: []
      }
      voice_sessions: {
        Row: {
          company_id: string | null
          created_at: string | null
          driving_mode: boolean | null
          duration_seconds: number | null
          id: string
          response: string | null
          transcript: string | null
          user_identifier: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          driving_mode?: boolean | null
          duration_seconds?: number | null
          id?: string
          response?: string | null
          transcript?: string | null
          user_identifier?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          driving_mode?: boolean | null
          duration_seconds?: number | null
          id?: string
          response?: string | null
          transcript?: string | null
          user_identifier?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          converted: boolean | null
          created_at: string | null
          email: string
          id: string
          source: string | null
        }
        Insert: {
          converted?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          converted?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      warehouse_intelligence: {
        Row: {
          avg_weight_variance: number | null
          calculated_at: string | null
          company_id: string | null
          damage_rate: number | null
          id: string
          period: string | null
          shortage_prediction_accuracy: number | null
          shortage_rate: number | null
          total_entries: number | null
          worst_carrier: string | null
          worst_supplier: string | null
        }
        Insert: {
          avg_weight_variance?: number | null
          calculated_at?: string | null
          company_id?: string | null
          damage_rate?: number | null
          id?: string
          period?: string | null
          shortage_prediction_accuracy?: number | null
          shortage_rate?: number | null
          total_entries?: number | null
          worst_carrier?: string | null
          worst_supplier?: string | null
        }
        Update: {
          avg_weight_variance?: number | null
          calculated_at?: string | null
          company_id?: string | null
          damage_rate?: number | null
          id?: string
          period?: string | null
          shortage_prediction_accuracy?: number | null
          shortage_rate?: number | null
          total_entries?: number | null
          worst_carrier?: string | null
          worst_supplier?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number | null
          delivered_at: string | null
          event_type: string | null
          id: string
          last_attempt: string | null
          payload: Json | null
          status: string | null
          subscription_id: string | null
        }
        Insert: {
          attempts?: number | null
          delivered_at?: string | null
          event_type?: string | null
          id?: string
          last_attempt?: string | null
          payload?: Json | null
          status?: string | null
          subscription_id?: string | null
        }
        Update: {
          attempts?: number | null
          delivered_at?: string | null
          event_type?: string | null
          id?: string
          last_attempt?: string | null
          payload?: Json | null
          status?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          active: boolean | null
          company_id: string | null
          created_at: string | null
          events: string[] | null
          id: string
          secret: string | null
          url: string
        }
        Insert: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          events?: string[] | null
          id?: string
          secret?: string | null
          url: string
        }
        Update: {
          active?: boolean | null
          company_id?: string | null
          created_at?: string | null
          events?: string[] | null
          id?: string
          secret?: string | null
          url?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          company_id: string | null
          created_at: string | null
          direction: string | null
          document_classified_as: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_body: string | null
          status: string | null
          supplier_phone: string | null
          trafico_id: string | null
          twilio_sid: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          direction?: string | null
          document_classified_as?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_body?: string | null
          status?: string | null
          supplier_phone?: string | null
          trafico_id?: string | null
          twilio_sid?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          direction?: string | null
          document_classified_as?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_body?: string | null
          status?: string | null
          supplier_phone?: string | null
          trafico_id?: string | null
          twilio_sid?: string | null
        }
        Relationships: []
      }
      workflow_chains: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          source_event: string
          source_workflow: string
          target_event: string
          target_workflow: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          source_event: string
          source_workflow: string
          target_event: string
          target_workflow: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          source_event?: string
          source_workflow?: string
          target_event?: string
          target_workflow?: string
        }
        Relationships: []
      }
      workflow_events: {
        Row: {
          attempt_count: number
          company_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          parent_event_id: string | null
          payload: Json | null
          processing_at: string | null
          status: string
          trigger_id: string | null
          workflow: string
        }
        Insert: {
          attempt_count?: number
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          parent_event_id?: string | null
          payload?: Json | null
          processing_at?: string | null
          status?: string
          trigger_id?: string | null
          workflow: string
        }
        Update: {
          attempt_count?: number
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          parent_event_id?: string | null
          payload?: Json | null
          processing_at?: string | null
          status?: string
          trigger_id?: string | null
          workflow?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "workflow_events"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_metrics: {
        Row: {
          avg_duration_ms: number | null
          company_id: string
          created_at: string
          date: string
          events_completed: number
          events_failed: number
          events_total: number
          id: string
          workflow: string
        }
        Insert: {
          avg_duration_ms?: number | null
          company_id: string
          created_at?: string
          date?: string
          events_completed?: number
          events_failed?: number
          events_total?: number
          id?: string
          workflow: string
        }
        Update: {
          avg_duration_ms?: number | null
          company_id?: string
          created_at?: string
          date?: string
          events_completed?: number
          events_failed?: number
          events_total?: number
          id?: string
          workflow?: string
        }
        Relationships: []
      }
      yourloop_users: {
        Row: {
          charity: string | null
          created_at: string | null
          id: string
          name: string | null
          onboarded_at: string | null
          telegram_id: string
          tier: string | null
          wake_time: string | null
        }
        Insert: {
          charity?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          onboarded_at?: string | null
          telegram_id: string
          tier?: string | null
          wake_time?: string | null
        }
        Update: {
          charity?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          onboarded_at?: string | null
          telegram_id?: string
          tier?: string | null
          wake_time?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      aduanet_pedimento_full: {
        Row: {
          aduana: string | null
          coves: string | null
          fecha_pago: string | null
          nombre_cliente: string | null
          num_coves: number | null
          num_facturas: number | null
          patente: string | null
          pedimento: string | null
          proveedores: string | null
          referencia: string | null
          rfc: string | null
          tenant_id: string | null
          total_dta: number | null
          total_igi: number | null
          total_iva: number | null
          valor_total_usd: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aduanet_facturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      caza_ghost_clients: {
        Row: {
          avg_crossings_per_month: number | null
          avg_monthly_value_usd: number | null
          caza_score: number | null
          contact_attempts: number | null
          current_patente: string | null
          id: string | null
          last_contact: string | null
          last_crossing_240: string | null
          last_op_with_us: string | null
          next_action: string | null
          next_action_date: string | null
          owner: string | null
          razon_social: string | null
          rfc: string | null
          stage: string | null
          total_ops_with_us: number | null
        }
        Insert: {
          avg_crossings_per_month?: number | null
          avg_monthly_value_usd?: number | null
          caza_score?: number | null
          contact_attempts?: never
          current_patente?: string | null
          id?: string | null
          last_contact?: never
          last_crossing_240?: string | null
          last_op_with_us?: string | null
          next_action?: string | null
          next_action_date?: string | null
          owner?: string | null
          razon_social?: string | null
          rfc?: string | null
          stage?: string | null
          total_ops_with_us?: number | null
        }
        Update: {
          avg_crossings_per_month?: number | null
          avg_monthly_value_usd?: number | null
          caza_score?: number | null
          contact_attempts?: never
          current_patente?: string | null
          id?: string | null
          last_contact?: never
          last_crossing_240?: string | null
          last_op_with_us?: string | null
          next_action?: string | null
          next_action_date?: string | null
          owner?: string | null
          razon_social?: string | null
          rfc?: string | null
          stage?: string | null
          total_ops_with_us?: number | null
        }
        Relationships: []
      }
      caza_market_share: {
        Row: {
          market_share_pct: number | null
          patente: string | null
          total_ops: number | null
          total_value_usd: number | null
          unique_clients: number | null
        }
        Relationships: []
      }
      caza_pipeline_summary: {
        Row: {
          avg_score: number | null
          count: number | null
          overdue_actions: number | null
          stage: string | null
          stale_leads: number | null
          total_monthly_value: number | null
        }
        Relationships: []
      }
      clearance_sandbox_daily_scores: {
        Row: {
          accuracy_pct: number | null
          avg_score: number | null
          company_id: string | null
          passed: number | null
          run_date: string | null
          total_cost_usd: number | null
          total_tests: number | null
        }
        Relationships: []
      }
      compliance_latest: {
        Row: {
          anexo24_score: number | null
          audit_avg_confidence: number | null
          audit_category_breakdown: Json | null
          audit_correct: number | null
          audit_date: string | null
          audit_run_id: string | null
          audit_top_errors: Json | null
          audit_total: number | null
          classification_accuracy_score: number | null
          composite_score: number | null
          docs_score: number | null
          id: number | null
          pedimentos_score: number | null
          score_weights: Json | null
          scored_at: string | null
        }
        Relationships: []
      }
      expediente_completion_stats: {
        Row: {
          company_id: string | null
          completion_percent: number | null
          documents_uploaded: number | null
          is_complete: boolean | null
          pedimento: string | null
          total_documents: number | null
        }
        Relationships: []
      }
      pedimentos_assembled: {
        Row: {
          aduana: string | null
          company_id: string | null
          completeness_score: number | null
          cove_count: number | null
          cove_numeros: string[] | null
          descripcion_mercancia: string | null
          estatus: string | null
          facturas_resumen: string | null
          fecha_llegada: string | null
          fecha_pago: string | null
          fecha_presentacion: string | null
          fracciones: string | null
          importe_total: number | null
          last_updated: string | null
          num_partidas: number | null
          paises: string | null
          pedimento: string | null
          peso_bruto_total: number | null
          proveedores: string | null
          tenant_id: string | null
          tipo_cambio: string | null
          total_valor_dolar: number | null
          trafico_count: number | null
          traficos: string[] | null
          transportistas_extranjeros: string[] | null
          transportistas_mexicanos: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "traficos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_overview: {
        Row: {
          blocking_count: number | null
          blocking_docs: Json | null
          can_cross: boolean | null
          can_file: boolean | null
          company_id: string | null
          descripcion_mercancia: string | null
          docs_present: number | null
          docs_required: number | null
          estatus: string | null
          fecha_llegada: string | null
          importe_total: number | null
          pipeline_stage: string | null
          score: number | null
          semaforo: number | null
          tenant_slug: string | null
          trafico_id: string | null
          trafico_number: string | null
          updated_at: string | null
          warning_count: number | null
        }
        Relationships: []
      }
      sandbox_daily_scores: {
        Row: {
          accuracy_pct: number | null
          avg_latency_ms: number | null
          avg_score: number | null
          company_id: string | null
          passed: number | null
          run_date: string | null
          total_cost_usd: number | null
          total_tests: number | null
          total_tokens: number | null
        }
        Relationships: []
      }
      trafico_actions: {
        Row: {
          action_context: Json | null
          company_id: string | null
          dias_espera: number | null
          estatus: string | null
          id: number | null
          importe_total: number | null
          primary_action: string | null
          trafico: string | null
        }
        Insert: {
          action_context?: never
          company_id?: string | null
          dias_espera?: never
          estatus?: string | null
          id?: number | null
          importe_total?: number | null
          primary_action?: never
          trafico?: string | null
        }
        Update: {
          action_context?: never
          company_id?: string | null
          dias_espera?: never
          estatus?: string | null
          id?: number | null
          importe_total?: number | null
          primary_action?: never
          trafico?: string | null
        }
        Relationships: []
      }
      user_tier: {
        Row: {
          current_period_end: string | null
          email: string | null
          id: string | null
          name: string | null
          onboarded_at: string | null
          status: string | null
          telegram_id: string | null
          tier: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      find_classification_patterns: {
        Args: {
          p_max_results?: number
          p_min_consistency?: number
          p_min_count?: number
        }
        Returns: {
          consistency: number
          cve_proveedor: string
          descripcion: string
          fraccion: string
          fraccion_count: number
          sample_ids: number[]
          total_count: number
        }[]
      }
      get_job_health: {
        Args: never
        Returns: {
          error_message: string
          finished_at: string
          job_name: string
          minutes_since: number
          rows_processed: number
          started_at: string
          status: string
        }[]
      }
      get_kpi_intelligence: { Args: { p_company_id: string }; Returns: Json }
      normalize_proveedor: { Args: { raw: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
    Enums: {},
  },
} as const
