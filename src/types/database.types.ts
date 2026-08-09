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
          label_width: number | null
          queue: string
          source_node_id: string
          target_node_id: string
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
          label_width?: number | null
          queue?: string
          source_node_id: string
          target_node_id: string
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
          label_width?: number | null
          queue?: string
          source_node_id?: string
          target_node_id?: string
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
      robos: {
        Row: {
          alteracao_realizada: string
          ambiente: string
          ativo: boolean
          cliente_id: string
          cliente_cor: string
          court_name: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string
          fila: string
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
          pacote_cor: string
          responsavel: string
          sistema: string
          stack: string
          updated_at: string
          updated_by: string | null
          versao: string
        }
        Insert: {
          alteracao_realizada?: string
          ambiente: string
          ativo?: boolean
          cliente_id: string
          cliente_cor?: string
          court_name: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao: string
          fila: string
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
          pacote_cor?: string
          responsavel: string
          sistema: string
          stack: string
          updated_at?: string
          updated_by?: string | null
          versao: string
        }
        Update: {
          alteracao_realizada?: string
          ambiente?: string
          ativo?: boolean
          cliente_id?: string
          cliente_cor?: string
          court_name?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string
          fila?: string
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
          pacote_cor?: string
          responsavel?: string
          sistema?: string
          stack?: string
          updated_at?: string
          updated_by?: string | null
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
      get_flow_creator_name: {
        Args: { target_flow_id: string }
        Returns: string
      }
      publish_flow: {
        Args: { target_flow_id: string; target_snapshot: Json }
        Returns: number
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
