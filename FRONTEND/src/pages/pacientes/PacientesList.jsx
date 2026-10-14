import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import {
  Card,
  Box,
  Typography,
  Stack,
  CircularProgress,
  TextField,
  Button,
  Divider,
  Alert,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { useAuth } from "../../hooks/useAuth";
import { toast } from "sonner";
import PacientesTabCreate from "./PacientesTabCreate";
import { formatRut, RutFormat } from "@fdograph/rut-utilities";
import { normalizeRut } from "../../lib/utils";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import ExamenesTabList from "../examenes/ExamenesTabList";
import ExamenForm from "../examenes/ExamenForm";
import { Tabs, Tab } from "@mui/material";
import ListIcon from "@mui/icons-material/List";

export default function PacientesList() {
  const [searching, setSearching] = useState(false);
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null);
  const [examenesPaciente, setExamenesPaciente] = useState([]);
  const [rutBuscado, setRutBuscado] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoPaciente, setEditandoPaciente] = useState(false);
  const [tabExamenes, setTabExamenes] = useState(0);
  const [editandoExamenId, setEditandoExamenId] = useState(null);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const { role } = useAuth();
  const navigate = useNavigate();

  const buscarPorRut = async () => {
    if (!rutBuscado.trim()) {
      toast.error("Por favor ingrese un RUT");
      return;
    }

    try {
      setSearching(true);
      setBusquedaRealizada(true);
      const rutNormalizado = normalizeRut(rutBuscado);
      const { data } = await api.get(`/pacientes/buscar/rut/${rutNormalizado}`);
      
      // Paciente encontrado
      setPacienteEncontrado(data);
      setMostrarFormulario(false);
      
      // Cargar exámenes del paciente
      try {
        const { data: examenesData } = await api.get(`/examenes/paciente/${data.id}`);
        setExamenesPaciente(examenesData || []);
      } catch (error) {
        console.error("Error al cargar exámenes:", error);
        setExamenesPaciente([]);
      }
    } catch (error) {
      // Paciente no encontrado
      if (error.response?.status === 404) {
        setPacienteEncontrado(null);
        setExamenesPaciente([]);
        setMostrarFormulario(false);
      } else {
        toast.error("Error al buscar paciente");
      }
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      buscarPorRut();
    }
  };

  const handleCreateSuccess = async () => {
    setMostrarFormulario(false);
    setEditandoPaciente(false);
    // Si hay un RUT buscado, buscar el paciente nuevamente
    if (rutBuscado) {
      await buscarPorRut();
    } else {
      // Si no hay RUT, limpiar todo
      setPacienteEncontrado(null);
      setExamenesPaciente([]);
    }
  };

  const handleExamenEdit = (examenId) => {
    setEditandoExamenId(examenId);
    setTabExamenes(1);
  };

  const handleExamenCreateSuccess = async () => {
    setTabExamenes(0);
    setEditandoExamenId(null);
    // Recargar exámenes del paciente
    if (pacienteEncontrado) {
      try {
        const { data: examenesData } = await api.get(`/examenes/paciente/${pacienteEncontrado.id}`);
        setExamenesPaciente(examenesData || []);
      } catch (error) {
        console.error("Error al cargar exámenes:", error);
      }
    }
  };

  const handleTabExamenesChange = (event, newValue) => {
    setTabExamenes(newValue);
    if (newValue === 0) {
      setEditandoExamenId(null);
    }
  };

  const loadExamenes = async () => {
    if (pacienteEncontrado) {
      try {
        const { data: examenesData } = await api.get(`/examenes/paciente/${pacienteEncontrado.id}`);
        setExamenesPaciente(examenesData || []);
      } catch (error) {
        console.error("Error al cargar exámenes:", error);
        setExamenesPaciente([]);
      }
    }
  };

  return (
    <Stack spacing={3}>
      <div className="flex flex-row gap-4">
        <PeopleIcon className="text-primary" sx={{ fontSize: 40 }} />
        <div className="flex flex-col pt-1">
          <Typography variant="h5" color="primary">
            Gestión de Pacientes
          </Typography>
          <Typography variant="body" className="!pt-1 !mt-0 text-gray-800">
            Busca un paciente por RUT para ver su información y exámenes médicos.
          </Typography>
        </div>
      </div>

      {/* Búsqueda por RUT */}
      <Card sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <Box sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <TextField
              label="Buscar por RUT"
              value={rutBuscado}
              onChange={(e) => {
                // Solo actualizar el valor sin formato mientras se escribe
                setRutBuscado(e.target.value);
                // Resetear el estado de búsqueda cuando se modifica el RUT
                setBusquedaRealizada(false);
                setPacienteEncontrado(null);
                setExamenesPaciente([]);
              }}
              onBlur={(e) => {
                // Aplicar formato solo al salir del campo
                const formatted = formatRut(e.target.value, RutFormat.DOTS_DASH);
                setRutBuscado(formatted);
              }}
              onKeyPress={handleKeyPress}
              placeholder="Ej: 12.345.678-9"
              sx={{ flex: 1, maxWidth: 400 }}
              disabled={searching || editandoPaciente}
            />
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={buscarPorRut}
              disabled={searching || !rutBuscado.trim() || editandoPaciente}
            >
              {searching ? "Buscando..." : "Buscar"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setMostrarFormulario(true);
                setEditandoPaciente(false);
                setPacienteEncontrado(null);
                setRutBuscado("");
                setExamenesPaciente([]);
              }}
              disabled={searching || editandoPaciente}
            >
              Registrar Paciente
            </Button>
          </Stack>
        </Box>
      </Card>

      {/* Resultado de búsqueda */}
      {searching && (
        <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
          <Typography>Buscando paciente...</Typography>
        </Stack>
      )}

      {!searching && pacienteEncontrado && !editandoPaciente && (
        <>
          {/* Información del paciente */}
          <Card sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <Box sx={{ p: 3 }}>
              <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Información del Paciente
                  </Typography>
                  <Stack spacing={1.5}>
                    <Typography variant="body1">
                      <strong>Nombre:</strong> {`${pacienteEncontrado.primer_nombre} ${pacienteEncontrado.apellido_paterno} ${pacienteEncontrado.apellido_materno || ""}`.trim()}
                    </Typography>
                    <Typography variant="body1">
                      <strong>RUT:</strong> {pacienteEncontrado.rut}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Email:</strong> {pacienteEncontrado.email || "-"}
                    </Typography>
                    <Typography variant="body1">
                      <strong>Teléfono:</strong> {pacienteEncontrado.telefono || "-"}
                    </Typography>
                    {pacienteEncontrado.fecha_nacimiento && (
                      <Typography variant="body1">
                        <strong>Fecha de Nacimiento:</strong> {new Date(pacienteEncontrado.fecha_nacimiento).toLocaleDateString("es-CL")}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setEditandoPaciente(true);
                    setMostrarFormulario(false);
                  }}
                >
                  Editar Paciente
                </Button>
              </Stack>
            </Box>
          </Card>

          {/* Tabla de exámenes con funcionalidad completa */}
          <Card sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs value={tabExamenes} onChange={handleTabExamenesChange}>
                <Tab
                  label="Listar Exámenes"
                  icon={<ListIcon />}
                  iconPosition="start"
                  className="!min-h-[auto] !h-auto !pt-4"
                />
                {(role === "medico" || role === "admin") && (
                  <Tab
                    label="Nuevo Examen"
                    icon={<AddIcon />}
                    iconPosition="start"
                    className="!min-h-[auto] !h-auto !pt-4"
                  />
                )}
              </Tabs>
            </Box>

            {tabExamenes === 0 && (
              <Box sx={{ p: 3 }}>
                <ExamenesTabList
                  items={examenesPaciente}
                  onLoad={loadExamenes}
                  onEdit={handleExamenEdit}
                />
              </Box>
            )}
            {tabExamenes === 1 && (
              <Box sx={{ p: 3 }}>
                <ExamenForm
                  onSuccess={handleExamenCreateSuccess}
                  examenId={editandoExamenId}
                  pacienteIdPreseleccionado={pacienteEncontrado?.id}
                />
              </Box>
            )}
          </Card>
        </>
      )}

      {!searching && !pacienteEncontrado && rutBuscado && busquedaRealizada && (
        <Card sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <Box sx={{ p: 3 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              El paciente con RUT {rutBuscado} no se encuentra registrado en el sistema.
            </Alert>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setMostrarFormulario(true)}
            >
              Registrar Nuevo Paciente
            </Button>
          </Box>
        </Card>
      )}

      {/* Formulario de registro (cuando no existe el paciente) */}
      {mostrarFormulario && !editandoPaciente && (
        <Card sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <Box sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Registrar Nuevo Paciente
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setMostrarFormulario(false);
                  setRutBuscado("");
                }}
              >
                Cancelar
              </Button>
            </Stack>
            <Divider sx={{ mb: 3 }} />
            <PacientesTabCreate 
              onSuccess={handleCreateSuccess}
              initialValues={{
                rut: rutBuscado,
                primer_nombre: "",
                apellido_paterno: "",
                apellido_materno: "",
                fecha_nacimiento: "",
                sexo: "",
                nacionalidad: "",
                estado_civil: "",
                email: "",
                telefono: "",
                direccion: "",
                contacto_emergencia_nombre: "",
                contacto_emergencia_telefono: "",
                contacto_emergencia_relacion: "",
                tipo_prevision: "",
                tiene_convenio: false,
                grupo_sanguineo: "",
                alergias: "",
                enfermedades_cronicas: "",
                discapacidades: "",
                observaciones_medicas_generales: "",
              }}
            />
          </Box>
        </Card>
      )}

      {/* Formulario de edición */}
      {editandoPaciente && pacienteEncontrado && (
        <Card sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <Box sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center" sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                onClick={async () => {
                  setEditandoPaciente(false);
                  // Restaurar el estado anterior: buscar el paciente nuevamente con el RUT que tenía
                  if (rutBuscado) {
                    await buscarPorRut();
                  }
                }}
              >
                Cancelar
              </Button>
            </Stack>
            <Divider sx={{ mb: 3 }} />
            <PacientesTabCreate 
              onSuccess={async () => {
                setEditandoPaciente(false);
                // Después de actualizar, buscar nuevamente para refrescar los datos
                if (rutBuscado) {
                  await buscarPorRut();
                }
              }}
              onCancel={async () => {
                setEditandoPaciente(false);
                // Restaurar el estado anterior: buscar el paciente nuevamente con el RUT que tenía
                if (rutBuscado) {
                  await buscarPorRut();
                }
              }}
              pacienteId={pacienteEncontrado.id}
              initialValues={{
                rut: pacienteEncontrado.rut,
                primer_nombre: pacienteEncontrado.primer_nombre || "",
                apellido_paterno: pacienteEncontrado.apellido_paterno || "",
                apellido_materno: pacienteEncontrado.apellido_materno || "",
                fecha_nacimiento: pacienteEncontrado.fecha_nacimiento ? pacienteEncontrado.fecha_nacimiento.split("T")[0] : "",
                sexo: pacienteEncontrado.sexo || "",
                nacionalidad: pacienteEncontrado.nacionalidad || "",
                estado_civil: pacienteEncontrado.estado_civil || "",
                email: pacienteEncontrado.email || "",
                telefono: pacienteEncontrado.telefono || "",
                direccion: pacienteEncontrado.direccion || "",
                contacto_emergencia_nombre: pacienteEncontrado.contacto_emergencia_nombre || "",
                contacto_emergencia_telefono: pacienteEncontrado.contacto_emergencia_telefono || "",
                contacto_emergencia_relacion: pacienteEncontrado.contacto_emergencia_relacion || "",
                tipo_prevision: pacienteEncontrado.tipo_prevision || "",
                tiene_convenio: pacienteEncontrado.tiene_convenio || false,
                grupo_sanguineo: pacienteEncontrado.grupo_sanguineo || "",
                alergias: pacienteEncontrado.alergias || "",
                enfermedades_cronicas: pacienteEncontrado.enfermedades_cronicas || "",
                discapacidades: pacienteEncontrado.discapacidades || "",
                observaciones_medicas_generales: pacienteEncontrado.observaciones_medicas_generales || "",
              }}
            />
          </Box>
        </Card>
      )}
    </Stack>
  );
}
