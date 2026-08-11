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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      personal_meetings: {
        Row: { created_at: string; id: string; meeting_date: string; meeting_time: string; name: string; notes: string; participants: string | null; summary: string | null; updated_at: string; user_id: string }
        Insert: { created_at?: string; id?: string; meeting_date: string; meeting_time: string; name: string; notes?: string; participants?: string | null; summary?: string | null; updated_at?: string; user_id: string }
        Update: { created_at?: string; id?: string; meeting_date?: string; meeting_time?: string; name?: string; notes?: string; participants?: string | null; summary?: string | null; updated_at?: string; user_id?: string }
        Relationships: [{ foreignKeyName: "personal_meetings_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      personal_notes: {
        Row: { content: string; created_at: string; id: string; title: string; updated_at: string; user_id: string }
        Insert: { content?: string; created_at?: string; id?: string; title: string; updated_at?: string; user_id: string }
        Update: { content?: string; created_at?: string; id?: string; title?: string; updated_at?: string; user_id?: string }
        Relationships: [{ foreignKeyName: "personal_notes_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }]
      }
      personal_page_flows: {
        Row: { created_at: string; flow_id: string; user_id: string }
        Insert: { created_at?: string; flow_id: string; user_id: string }
        Update: { created_at?: string; flow_id?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "personal_page_flows_flow_id_fkey"; columns: ["flow_id"]; isOneToOne: false; referencedRelation: "flows"; referencedColumns: ["id"] },
          { foreignKeyName: "personal_page_flows_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      personal_page_preferences: {
        Row: { created_at: string; show_robot_table: boolean; updated_at: string; user_id: string }
        Insert: { created_at?: string; show_robot_table?: boolean; updated_at?: string; user_id: string }
        Update: { created_at?: string; show_robot_table?: boolean; updated_at?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "personal_page_preferences_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      personal_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          note: string | null
          origin_meeting_id: string | null
          origin_note_id: string | null
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          note?: string | null
          origin_meeting_id?: string | null
          origin_note_id?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          note?: string | null
          origin_meeting_id?: string | null
          origin_note_id?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          { foreignKeyName: "personal_tasks_origin_meeting_id_fkey"; columns: ["origin_meeting_id"]; isOneToOne: false; referencedRelation: "personal_meetings"; referencedColumns: ["id"] },
          { foreignKeyName: "personal_tasks_origin_note_id_fkey"; columns: ["origin_note_id"]; isOneToOne: false; referencedRelation: "personal_notes"; referencedColumns: ["id"] },
          {
            foreignKeyName: "personal_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alteracoes_robo: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string
          id: string
          realizada_em: string
          robo_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao: string
          id?: string
          realizada_em?: string
          robo_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string
          id?: string
          realizada_em?: string
          robo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alteracoes_robo_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alteracoes_robo_robo_id_fkey"
            columns: ["robo_id"]
            isOneToOne: false
            referencedRelation: "robos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cor: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          nome: string
          tenant: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cor?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nome: string
          tenant: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cor?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          nome?: string
          tenant?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_edges: {
        Row: {
          condition: string
          created_at: string
          created_by: string
          description: string
          flow_id: string
          id: string
          label: string
          label_height: number | null
          label_offset_x: number | null
          label_offset_y: number | null
          label_width: number | null
          queue: string
          source_node_id: string
          source_handle: string | null
          target_node_id: string
          target_handle: string | null
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          condition?: string
          created_at?: string
          created_by?: string
          description?: string
          flow_id: string
          id?: string
          label?: string
          label_height?: number | null
          label_offset_x?: number | null
          label_offset_y?: number | null
          label_width?: number | null
          queue?: string
          source_node_id: string
          source_handle?: string | null
          target_node_id: string
          target_handle?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          condition?: string
          created_at?: string
          created_by?: string
          description?: string
          flow_id?: string
          id?: string
          label?: string
          label_height?: number | null
          label_offset_x?: number | null
          label_offset_y?: number | null
          label_width?: number | null
          queue?: string
          source_node_id?: string
          source_handle?: string | null
          target_node_id?: string
          target_handle?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "flow_edges_flow_id_fkey"; columns: ["flow_id"]; isOneToOne: false; referencedRelation: "flows"; referencedColumns: ["id"] },
          { foreignKeyName: "flow_edges_source_same_flow_fkey"; columns: ["source_node_id", "flow_id"]; isOneToOne: false; referencedRelation: "flow_nodes"; referencedColumns: ["id", "flow_id"] },
          { foreignKeyName: "flow_edges_target_same_flow_fkey"; columns: ["target_node_id", "flow_id"]; isOneToOne: false; referencedRelation: "flow_nodes"; referencedColumns: ["id", "flow_id"] },
        ]
      }
      flow_nodes: {
        Row: {
          created_at: string
          created_by: string
          data: Json
          flow_id: string
          id: string
          position_x: number
          position_y: number
          robot_id: string | null
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          data?: Json
          flow_id: string
          id?: string
          position_x?: number
          position_y?: number
          robot_id?: string | null
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: Json
          flow_id?: string
          id?: string
          position_x?: number
          position_y?: number
          robot_id?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "flow_nodes_flow_id_fkey"; columns: ["flow_id"]; isOneToOne: false; referencedRelation: "flows"; referencedColumns: ["id"] },
          { foreignKeyName: "flow_nodes_robot_id_fkey"; columns: ["robot_id"]; isOneToOne: false; referencedRelation: "robos"; referencedColumns: ["id"] },
        ]
      }
      flow_versions: {
        Row: {
          created_at: string
          created_by: string
          flow_id: string
          id: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          flow_id: string
          id?: string
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          flow_id?: string
          id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          { foreignKeyName: "flow_versions_flow_id_fkey"; columns: ["flow_id"]; isOneToOne: false; referencedRelation: "flows"; referencedColumns: ["id"] },
        ]
      }
      flows: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
          status: string
          updated_at: string
          updated_by: string | null
          version: number
          viewport: Json
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          viewport?: Json
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          viewport?: Json
        }
        Relationships: [
          { foreignKeyName: "flows_client_id_fkey"; columns: ["client_id"]; isOneToOne: false; referencedRelation: "clientes"; referencedColumns: ["id"] },
          { foreignKeyName: "flows_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "flows_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      permissions: {
        Row: {
          acao: string
          ativo: boolean
          codigo: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          recurso: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acao: string
          ativo?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          recurso: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acao?: string
          ativo?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          recurso?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          login: string
          pode_editar_robos_cliente: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id: string
          login: string
          pode_editar_robos_cliente?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          login?: string
          pode_editar_robos_cliente?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          descricao: string
          id: string
          publicada_em: string
          robo_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          created_by?: string | null
          descricao: string
          id?: string
          publicada_em?: string
          robo_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          descricao?: string
          id?: string
          publicada_em?: string
          robo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_robo_id_fkey"
            columns: ["robo_id"]
            isOneToOne: false
            referencedRelation: "robos"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_robo: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string
          id: string
          ordem: number
          parent_id: string | null
          robo_id: string
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao: string
          id?: string
          ordem: number
          parent_id?: string | null
          robo_id: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string
          id?: string
          ordem?: number
          parent_id?: string | null
          robo_id?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regras_robo_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_robo_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_robo_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "regras_robo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_robo_robo_id_fkey"
            columns: ["robo_id"]
            isOneToOne: false
            referencedRelation: "robos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_robo_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_uploaded_documents: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          file_name: string
          id: string
          mime_type: string
          robot_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_name: string
          id?: string
          mime_type: string
          robot_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_name?: string
          id?: string
          mime_type?: string
          robot_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "robot_uploaded_documents_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "robot_uploaded_documents_deleted_by_fkey"; columns: ["deleted_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "robot_uploaded_documents_robot_id_fkey"; columns: ["robot_id"]; isOneToOne: false; referencedRelation: "robos"; referencedColumns: ["id"] },
          { foreignKeyName: "robot_uploaded_documents_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      robot_center_documentation_blocks: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          draft_id: string
          id: string
          metadata: Json
          ordem: number
          related_block_id: string | null
          requirement_id: string | null
          section_id: string | null
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          draft_id: string
          id?: string
          metadata?: Json
          ordem: number
          related_block_id?: string | null
          requirement_id?: string | null
          section_id?: string | null
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          draft_id?: string
          id?: string
          metadata?: Json
          ordem?: number
          related_block_id?: string | null
          requirement_id?: string | null
          section_id?: string | null
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "robot_center_documentation_blocks_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "robot_center_documentation_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robot_center_documentation_blocks_related_block_id_fkey"
            columns: ["related_block_id"]
            isOneToOne: false
            referencedRelation: "robot_center_documentation_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robot_center_documentation_blocks_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "regras_robo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robot_center_documentation_blocks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "robot_center_documentation_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_center_documentation_drafts: {
        Row: {
          created_at: string
          created_by: string | null
          documentation_id: string
          id: string
          revision: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          documentation_id: string
          id?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          documentation_id?: string
          id?: string
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "robot_center_documentation_drafts_documentation_id_fkey"
            columns: ["documentation_id"]
            isOneToOne: true
            referencedRelation: "robot_center_documentations"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_center_documentation_sections: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          draft_id: string
          id: string
          ordem: number
          section_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          draft_id: string
          id?: string
          ordem: number
          section_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          draft_id?: string
          id?: string
          ordem?: number
          section_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "robot_center_documentation_sections_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "robot_center_documentation_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_center_documentation_templates: {
        Row: { active: boolean; created_at: string; created_by: string | null; id: string; name: string; storage_path: string; updated_at: string; updated_by: string | null; version: number }
        Insert: { active?: boolean; created_at?: string; created_by?: string | null; id?: string; name: string; storage_path: string; updated_at?: string; updated_by?: string | null; version: number }
        Update: { active?: boolean; created_at?: string; created_by?: string | null; id?: string; name?: string; storage_path?: string; updated_at?: string; updated_by?: string | null; version?: number }
        Relationships: []
      }
      robot_center_documentation_versions: {
        Row: {
          created_at: string
          created_by: string
          documentation_id: string
          docx_path: string | null
          error_message: string | null
          generation_token: string | null
          id: string
          pdf_path: string | null
          published_at: string | null
          snapshot: Json
          started_at: string
          status: string
          template_id: string | null
          template_version: number | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          documentation_id: string
          docx_path?: string | null
          error_message?: string | null
          generation_token?: string | null
          id?: string
          pdf_path?: string | null
          published_at?: string | null
          snapshot?: Json
          started_at?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
          updated_by?: string | null
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          documentation_id?: string
          docx_path?: string | null
          error_message?: string | null
          generation_token?: string | null
          id?: string
          pdf_path?: string | null
          published_at?: string | null
          snapshot?: Json
          started_at?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "robot_center_documentation_versions_documentation_id_fkey"
            columns: ["documentation_id"]
            isOneToOne: false
            referencedRelation: "robot_center_documentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robot_center_documentation_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_center_documentations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          current_version_id: string | null
          robo_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          current_version_id?: string | null
          robo_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          current_version_id?: string | null
          robo_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "robot_center_documentations_robo_id_fkey"
            columns: ["robo_id"]
            isOneToOne: true
            referencedRelation: "robos"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_packages: {
        Row: { id: string; name: string; color: string; active: boolean; created_at: string; updated_at: string; created_by: string | null; updated_by: string | null; deleted_at: string | null; deleted_by: string | null }
        Insert: { id?: string; name: string; color?: string; active?: boolean; created_at?: string; updated_at?: string; created_by?: string | null; updated_by?: string | null; deleted_at?: string | null; deleted_by?: string | null }
        Update: { id?: string; name?: string; color?: string; active?: boolean; created_at?: string; updated_at?: string; created_by?: string | null; updated_by?: string | null; deleted_at?: string | null; deleted_by?: string | null }
        Relationships: []
      }
      robot_stacks: {
        Row: { id: string; name: string; active: boolean; created_at: string; updated_at: string; created_by: string | null; updated_by: string | null; deleted_at: string | null; deleted_by: string | null }
        Insert: { id?: string; name: string; active?: boolean; created_at?: string; updated_at?: string; created_by?: string | null; updated_by?: string | null }
        Update: { id?: string; name?: string; active?: boolean; created_at?: string; updated_at?: string; created_by?: string | null; updated_by?: string | null }
        Relationships: []
      }
      robot_queues: {
        Row: { id: string; name: string; active: boolean; created_at: string; updated_at: string; created_by: string | null; updated_by: string | null }
        Insert: { id?: string; name: string; active?: boolean; created_at?: string; updated_at?: string; created_by?: string | null; updated_by?: string | null }
        Update: { id?: string; name?: string; active?: boolean; created_at?: string; updated_at?: string; created_by?: string | null; updated_by?: string | null }
        Relationships: []
      }
      robot_commands: {
        Row: { id: string; name: string; command: string; active: boolean; created_at: string; updated_at: string; created_by: string | null; updated_by: string | null }
        Insert: { id?: string; name: string; command: string; active?: boolean; created_at?: string; updated_at?: string; created_by?: string | null; updated_by?: string | null }
        Update: { id?: string; name?: string; command?: string; active?: boolean; created_at?: string; updated_at?: string; created_by?: string | null; updated_by?: string | null }
        Relationships: []
      }
      robos: {
        Row: {
          alteracao_realizada: string
          ambiente: string
          ativo: boolean
          cliente_id: string | null
          cliente_cor: string
          command: string
          command_id: string | null
          court_name: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string
          fila: string
          queue_id: string | null
          disparo: string
          gatilho_de_robo_id: string | null
          gatilho_para_robo_id: string | null
          id: string
          ideal: number
          max: number
          manual_nome: string | null
          manual_path: string | null
          nome: string
          pacote: string
          package_id: string | null
          pacote_cor: string
          product_type: string
          responsavel: string
          sistema: string
          stack: string | null
          stack_id: string | null
          tribunal: string | null
          tribunal_system: string | null
          updated_at: string
          updated_by: string | null
          version_checked_at: string | null
          versao: string
        }
        Insert: {
          alteracao_realizada?: string
          ambiente: string
          ativo?: boolean
          cliente_id?: string | null
          cliente_cor?: string
          command?: string
          command_id?: string | null
          court_name: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao: string
          fila: string
          queue_id?: string | null
          disparo?: string
          gatilho_de_robo_id?: string | null
          gatilho_para_robo_id?: string | null
          id?: string
          ideal?: number
          max?: number
          manual_nome?: string | null
          manual_path?: string | null
          nome: string
          pacote: string
          package_id?: string | null
          pacote_cor?: string
          product_type?: string
          responsavel: string
          sistema: string
          stack?: string | null
          stack_id?: string | null
          tribunal?: string | null
          tribunal_system?: string | null
          updated_at?: string
          updated_by?: string | null
          version_checked_at?: string | null
          versao: string
        }
        Update: {
          alteracao_realizada?: string
          ambiente?: string
          ativo?: boolean
          cliente_id?: string
          cliente_cor?: string
          command?: string
          command_id?: string | null
          court_name?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string
          fila?: string
          queue_id?: string | null
          disparo?: string
          gatilho_de_robo_id?: string | null
          gatilho_para_robo_id?: string | null
          id?: string
          ideal?: number
          max?: number
          manual_nome?: string | null
          manual_path?: string | null
          nome?: string
          pacote?: string
          package_id?: string | null
          pacote_cor?: string
          product_type?: string
          responsavel?: string
          sistema?: string
          stack?: string | null
          stack_id?: string | null
          tribunal?: string | null
          tribunal_system?: string | null
          updated_at?: string
          updated_by?: string | null
          version_checked_at?: string | null
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "robos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robos_gatilho_de_fkey"
            columns: ["gatilho_de_robo_id"]
            isOneToOne: false
            referencedRelation: "robos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robos_gatilho_para_fkey"
            columns: ["gatilho_para_robo_id"]
            isOneToOne: false
            referencedRelation: "robos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robos_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stack_request_history: {
        Row: { changes: Json; created_at: string; created_by: string; event_type: string; id: string; message: string | null; new_status: string | null; previous_status: string | null; stack_request_id: string }
        Insert: { changes?: Json; created_at?: string; created_by?: string; event_type: string; id?: string; message?: string | null; new_status?: string | null; previous_status?: string | null; stack_request_id: string }
        Update: { changes?: Json; created_at?: string; created_by?: string; event_type?: string; id?: string; message?: string | null; new_status?: string | null; previous_status?: string | null; stack_request_id?: string }
        Relationships: [
          { foreignKeyName: "stack_request_history_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "stack_request_history_stack_request_id_fkey"; columns: ["stack_request_id"]; isOneToOne: false; referencedRelation: "stack_requests"; referencedColumns: ["id"] },
        ]
      }
      stack_requests: {
        Row: { completed_at: string | null; created_at: string; created_by: string; generated_stack: string | null; id: string; job: string; queue_id: string | null; requested_at: string; robot_id: string; status: string; suggested_stack_name: string; type: string; updated_at: string; updated_by: string | null }
        Insert: { completed_at?: string | null; created_at?: string; created_by?: string; generated_stack?: string | null; id?: string; job: string; queue_id?: string | null; requested_at?: string; robot_id: string; status?: string; suggested_stack_name: string; type: string; updated_at?: string; updated_by?: string | null }
        Update: { completed_at?: string | null; created_at?: string; created_by?: string; generated_stack?: string | null; id?: string; job?: string; queue_id?: string | null; requested_at?: string; robot_id?: string; status?: string; suggested_stack_name?: string; type?: string; updated_at?: string; updated_by?: string | null }
        Relationships: [
          { foreignKeyName: "stack_requests_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "stack_requests_queue_id_fkey"; columns: ["queue_id"]; isOneToOne: false; referencedRelation: "robot_queues"; referencedColumns: ["id"] },
          { foreignKeyName: "stack_requests_robot_id_fkey"; columns: ["robot_id"]; isOneToOne: false; referencedRelation: "robos"; referencedColumns: ["id"] },
          { foreignKeyName: "stack_requests_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      tutorial_drafts: {
        Row: { created_at: string; created_by: string; id: string; revision: number; tutorial_id: string; updated_at: string; updated_by: string | null }
        Insert: { created_at?: string; created_by?: string; id?: string; revision?: number; tutorial_id: string; updated_at?: string; updated_by?: string | null }
        Update: { created_at?: string; created_by?: string; id?: string; revision?: number; tutorial_id?: string; updated_at?: string; updated_by?: string | null }
        Relationships: [{ foreignKeyName: "tutorial_drafts_tutorial_id_fkey"; columns: ["tutorial_id"]; isOneToOne: true; referencedRelation: "tutorials"; referencedColumns: ["id"] }]
      }
      tutorial_steps: {
        Row: { condition_key: string | null; created_at: string; created_by: string; descricao: string; draft_id: string; habilitado: boolean; id: string; ordem: number; page_key: string; placement: string; target_key: string; titulo: string; updated_at: string; updated_by: string | null }
        Insert: { condition_key?: string | null; created_at?: string; created_by?: string; descricao?: string; draft_id: string; habilitado?: boolean; id?: string; ordem: number; page_key: string; placement?: string; target_key: string; titulo: string; updated_at?: string; updated_by?: string | null }
        Update: { condition_key?: string | null; created_at?: string; created_by?: string; descricao?: string; draft_id?: string; habilitado?: boolean; id?: string; ordem?: number; page_key?: string; placement?: string; target_key?: string; titulo?: string; updated_at?: string; updated_by?: string | null }
        Relationships: [{ foreignKeyName: "tutorial_steps_draft_id_fkey"; columns: ["draft_id"]; isOneToOne: false; referencedRelation: "tutorial_drafts"; referencedColumns: ["id"] }]
      }
      tutorial_versions: {
        Row: { id: string; published_at: string; published_by: string; snapshot: Json; tutorial_id: string; version: number }
        Insert: { id?: string; published_at?: string; published_by: string; snapshot: Json; tutorial_id: string; version: number }
        Update: { id?: string; published_at?: string; published_by?: string; snapshot?: Json; tutorial_id?: string; version?: number }
        Relationships: [{ foreignKeyName: "tutorial_versions_tutorial_id_fkey"; columns: ["tutorial_id"]; isOneToOne: false; referencedRelation: "tutorials"; referencedColumns: ["id"] }]
      }
      tutorials: {
        Row: { audience_role_id: string; created_at: string; created_by: string; current_version_id: string | null; id: string; nome: string; status: string; tutorial_key: string; updated_at: string; updated_by: string | null }
        Insert: { audience_role_id: string; created_at?: string; created_by?: string; current_version_id?: string | null; id?: string; nome: string; status?: string; tutorial_key: string; updated_at?: string; updated_by?: string | null }
        Update: { audience_role_id?: string; created_at?: string; created_by?: string; current_version_id?: string | null; id?: string; nome?: string; status?: string; tutorial_key?: string; updated_at?: string; updated_by?: string | null }
        Relationships: [
          { foreignKeyName: "tutorials_audience_role_id_fkey"; columns: ["audience_role_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id"] },
          { foreignKeyName: "tutorials_current_version_id_fkey"; columns: ["current_version_id"]; isOneToOne: false; referencedRelation: "tutorial_versions"; referencedColumns: ["id"] },
        ]
      }
      user_tutorial_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          started_at: string | null
          status: string
          tutorial_key: string
          tutorial_id: string | null
          tutorial_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          started_at?: string | null
          status?: string
          tutorial_key: string
          tutorial_id?: string | null
          tutorial_version: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          started_at?: string | null
          status?: string
          tutorial_key?: string
          tutorial_id?: string | null
          tutorial_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tutorial_progress_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tutorial_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_client_with_user_reassignment: {
        Args: { replacement_client_id?: string | null; target_client_id: string }
        Returns: number
      }
      create_tutorial: {
        Args: { target_audience_role_id: string; target_name: string }
        Returns: { tutorial_id: string; draft_id: string }[]
      }
      get_flow_creator_name: {
        Args: { target_flow_id: string }
        Returns: string
      }
      publish_flow: {
        Args: { target_flow_id: string; target_snapshot: Json }
        Returns: number
      }
      publish_tutorial: {
        Args: { target_tutorial_id: string }
        Returns: { version_id: string; version_number: number }[]
      }
      archive_robot_requirement: {
        Args: { target_requirement_id: string; target_robot_id: string }
        Returns: undefined
      }
      append_robot_documentation_image_block: {
        Args: {
          target_block_id: string
          target_draft_id: string
          target_metadata: Json
          target_requirement_id: string
          target_robot_id: string
        }
        Returns: Json
      }
      begin_robot_center_documentation_publication: {
        Args: { target_generation_token: string; target_robot_id: string }
        Returns: { version_id: string; version_number: number; documentation_id: string; draft_id: string; template_id: string; template_version: number; template_storage_path: string; reused: boolean }[]
      }
      complete_robot_center_documentation_publication: {
        Args: { target_docx_path: string; target_generation_token: string; target_pdf_path: string; target_snapshot: Json; target_version_id: string }
        Returns: undefined
      }
      fail_robot_center_documentation_publication: {
        Args: { target_error_message: string; target_generation_token: string; target_version_id: string }
        Returns: undefined
      }
      initialize_robot_center_documentation: {
        Args: { target_robot_id: string }
        Returns: { documentation_id: string; draft_id: string }[]
      }
      reorder_robot_requirements: {
        Args: {
          ordered_ids: string[]
          target_parent_id: string | null
          target_robot_id: string
          target_type: string
        }
        Returns: undefined
      }
      reorder_robot_documentation_blocks: {
        Args: {
          ordered_ids: string[]
          target_requirement_id: string
          target_robot_id: string
        }
        Returns: undefined
      }
      save_tutorial_draft: {
        Args: { target_audience_role_id: string; target_name: string; target_steps: Json; target_tutorial_id: string }
        Returns: undefined
      }
      update_robot_capacity: {
        Args: {
          target_ideal: number
          target_max: number
          target_robot_id: string
        }
        Returns: undefined
      }
      update_role_permission_matrix: {
        Args: { change_set: Json }
        Returns: undefined
      }
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
  public: {
    Enums: {},
  },
} as const
