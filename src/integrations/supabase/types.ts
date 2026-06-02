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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      causas_personalizadas: {
        Row: {
          created_at: string
          ensayo_codigo: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          ensayo_codigo: string
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          ensayo_codigo?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      datasets: {
        Row: {
          columns: Json
          created_at: string
          id: string
          name: string
          row_count: number
          rows: Json
        }
        Insert: {
          columns?: Json
          created_at?: string
          id?: string
          name: string
          row_count?: number
          rows?: Json
        }
        Update: {
          columns?: Json
          created_at?: string
          id?: string
          name?: string
          row_count?: number
          rows?: Json
        }
        Relationships: []
      }
      ensayos: {
        Row: {
          codigo: string
          created_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
        }
        Relationships: []
      }
      perdidas: {
        Row: {
          bloque: number | null
          cama: string
          causa: string
          created_at: string
          ensayo_codigo: string | null
          id: string
          parcela: string
          plantas_iniciales: number | null
          tallos: number
          tratamiento: string
          variedad: string
        }
        Insert: {
          bloque?: number | null
          cama: string
          causa: string
          created_at?: string
          ensayo_codigo?: string | null
          id?: string
          parcela: string
          plantas_iniciales?: number | null
          tallos?: number
          tratamiento: string
          variedad: string
        }
        Update: {
          bloque?: number | null
          cama?: string
          causa?: string
          created_at?: string
          ensayo_codigo?: string | null
          id?: string
          parcela?: string
          plantas_iniciales?: number | null
          tallos?: number
          tratamiento?: string
          variedad?: string
        }
        Relationships: []
      }
      productividad: {
        Row: {
          bloque: number | null
          cama: string
          created_at: string
          ensayo_codigo: string | null
          id: string
          parcela: string
          ramos: number
          tallos_por_ramo: number
          total: number
          tratamiento: string
          variedad: string
        }
        Insert: {
          bloque?: number | null
          cama: string
          created_at?: string
          ensayo_codigo?: string | null
          id?: string
          parcela: string
          ramos?: number
          tallos_por_ramo?: number
          total?: number
          tratamiento: string
          variedad: string
        }
        Update: {
          bloque?: number | null
          cama?: string
          created_at?: string
          ensayo_codigo?: string | null
          id?: string
          parcela?: string
          ramos?: number
          tallos_por_ramo?: number
          total?: number
          tratamiento?: string
          variedad?: string
        }
        Relationships: []
      }
      ramos_peso: {
        Row: {
          bloque: number | null
          cama: string
          created_at: string
          ensayo_codigo: string | null
          id: string
          numero: number
          parcela: string
          peso_g: number
          tallos_por_ramo: number
          tratamiento: string
        }
        Insert: {
          bloque?: number | null
          cama: string
          created_at?: string
          ensayo_codigo?: string | null
          id?: string
          numero: number
          parcela: string
          peso_g?: number
          tallos_por_ramo?: number
          tratamiento: string
        }
        Update: {
          bloque?: number | null
          cama?: string
          created_at?: string
          ensayo_codigo?: string | null
          id?: string
          numero?: number
          parcela?: string
          peso_g?: number
          tallos_por_ramo?: number
          tratamiento?: string
        }
        Relationships: []
      }
      siembras: {
        Row: {
          bloque: number
          cm: string
          created_at: string
          ensayo_codigo: string | null
          fecha: string | null
          id: string
          nom_flor: string
          plantas: number
          producto: string | null
          semana: string | null
        }
        Insert: {
          bloque: number
          cm: string
          created_at?: string
          ensayo_codigo?: string | null
          fecha?: string | null
          id?: string
          nom_flor: string
          plantas?: number
          producto?: string | null
          semana?: string | null
        }
        Update: {
          bloque?: number
          cm?: string
          created_at?: string
          ensayo_codigo?: string | null
          fecha?: string | null
          id?: string
          nom_flor?: string
          plantas?: number
          producto?: string | null
          semana?: string | null
        }
        Relationships: []
      }
      tallos: {
        Row: {
          bloque: number | null
          botones: number
          botones_piso2: number | null
          cama: string
          created_at: string
          ensayo_codigo: string | null
          id: string
          longitud_cm: number
          numero: number
          parcela: string
          piso: string | null
          tratamiento: string
          variedad: string | null
        }
        Insert: {
          bloque?: number | null
          botones?: number
          botones_piso2?: number | null
          cama: string
          created_at?: string
          ensayo_codigo?: string | null
          id?: string
          longitud_cm?: number
          numero: number
          parcela: string
          piso?: string | null
          tratamiento: string
          variedad?: string | null
        }
        Update: {
          bloque?: number | null
          botones?: number
          botones_piso2?: number | null
          cama?: string
          created_at?: string
          ensayo_codigo?: string | null
          id?: string
          longitud_cm?: number
          numero?: number
          parcela?: string
          piso?: string | null
          tratamiento?: string
          variedad?: string | null
        }
        Relationships: []
      }
      tratamientos: {
        Row: {
          cama: string
          created_at: string
          ensayo_codigo: string
          id: string
          nombre: string
          parcelas: number
          plantas_lista: Json | null
          plantas_por_parcela: number
        }
        Insert: {
          cama: string
          created_at?: string
          ensayo_codigo: string
          id?: string
          nombre: string
          parcelas?: number
          plantas_lista?: Json | null
          plantas_por_parcela?: number
        }
        Update: {
          cama?: string
          created_at?: string
          ensayo_codigo?: string
          id?: string
          nombre?: string
          parcelas?: number
          plantas_lista?: Json | null
          plantas_por_parcela?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
