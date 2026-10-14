import { useState, useEffect } from "react";
import {
  Button,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Box,
  IconButton,
  Paper,
  Autocomplete,
} from "@mui/material";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { useFormik } from "formik";
import * as yup from "yup";
import { useDropzone } from "react-dropzone";
import { useAuth } from "../../hooks/useAuth";

const examenSchema = yup.object().shape({
  tipo_examen_medico_id: yup
    .number()
    .required("El tipo de examen es requerido")
    .positive("Debe seleccionar un tipo de examen"),
  paciente_id: yup
    .number()
    .required("El paciente es requerido")
    .positive("Debe seleccionar un paciente"),
  diagnosis: yup.string().max(2000).optional(),
  tratamiento: yup.string().max(2000).optional(),
  observaciones: yup.string().max(2000).optional(),
  notas: yup.string().max(2000).optional(),
});

export default function ExamenForm({ onSuccess, examenId, pacienteIdPreseleccionado }) {
  const { role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tiposExamen, setTiposExamen] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [documentos, setDocumentos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);

  const formik = useFormik({
    initialValues: {
      tipo_examen_medico_id: "",
      paciente_id: "",
      diagnosis: "",
      tratamiento: "",
      observaciones: "",
      notas: "",
    },
    validationSchema: examenSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        let nuevoExamenId = examenId;
        if (examenId) {
          await api.put(`/examenes/${examenId}`, values);
          toast.success("Examen actualizado exitosamente");
        } else {
          const { data } = await api.post("/examenes", values);
          nuevoExamenId = data?.id;
          toast.success("Examen creado exitosamente");

          // Subir documentos pendientes si hay
          if (pendingFiles.length > 0 && nuevoExamenId) {
            await uploadPendingFiles(nuevoExamenId, values.paciente_id);
          }
        }
        formik.resetForm();
        setPendingFiles([]);
        onSuccess();
      } catch {
        // El error ya se maneja en el interceptor
      } finally {
        setLoading(false);
      }
    },
  });

  const loadData = async () => {
    try {
      setLoadingData(true);
      const [tiposRes, pacientesRes] = await Promise.all([
        api.get("/tipo-examen"),
        api.get("/pacientes"),
      ]);
      setTiposExamen(tiposRes.data || []);
      setPacientes(pacientesRes.data || []);
      
      // Si hay un paciente preseleccionado y no estamos editando, establecerlo
      if (pacienteIdPreseleccionado && !examenId) {
        formik.setFieldValue("paciente_id", pacienteIdPreseleccionado);
      }
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadExamen = async () => {
    try {
      const { data } = await api.get(`/examenes/${examenId}`);
      formik.setValues({
        tipo_examen_medico_id: data.tipo_examen_medico_id,
        paciente_id: data.paciente_id,
        diagnosis: data.diagnosis || "",
        tratamiento: data.tratamiento || "",
        observaciones: data.observaciones || "",
        notas: data.notas || "",
      });
      // Cargar documentos del examen
      loadDocumentos();
    } catch (error) {
      console.error("Error al cargar examen:", error);
    }
  };

  const loadDocumentos = async () => {
    if (!examenId) return;
    try {
      const { data } = await api.get(`/documentos/examen/${examenId}`);
      setDocumentos(data || []);
    } catch (error) {
      console.error("Error al cargar documentos:", error);
    }
  };

  const uploadPendingFiles = async (examenIdToUse, pacienteId) => {
    if (pendingFiles.length === 0 || !pacienteId) return;

    const formData = new FormData();
    pendingFiles.forEach((file) => {
      formData.append("documentos", file);
    });
    formData.append("examen_medico_id", examenIdToUse);
    formData.append("paciente_id", pacienteId);

    setUploading(true);
    try {
      await api.post("/documentos", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success("Documentos subidos exitosamente");
      setPendingFiles([]);
      if (examenIdToUse) {
        loadDocumentos();
      }
    } catch {
      toast.error("Error al subir documentos");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (documentoId) => {
    try {
      const response = await api.get(`/documentos/${documentoId}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `documento-${documentoId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Error al descargar documento");
    }
  };

  const handleDeleteDocument = async (documentoId, nombreArchivo) => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar el documento "${nombreArchivo}"?`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/documentos/${documentoId}`);
      toast.success("Documento eliminado");
      loadDocumentos();
    } catch {
      // El error ya se maneja en el interceptor
    }
  };

  const onDrop = async (acceptedFiles) => {
    // Si estamos creando un examen, guardar archivos en estado temporal
    if (!examenId) {
      if (!formik.values.paciente_id) {
        toast.error("Debe seleccionar un paciente primero");
        return;
      }
      setPendingFiles((prev) => [...prev, ...acceptedFiles]);
      toast.success(`${acceptedFiles.length} archivo(s) listo(s) para subir`);
      return;
    }

    // Si estamos editando, subir directamente
    if (!formik.values.paciente_id) {
      toast.error("Debe seleccionar un paciente primero");
      return;
    }

    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("documentos", file);
    });
    formData.append("examen_medico_id", examenId);
    formData.append("paciente_id", formik.values.paciente_id);

    setUploading(true);
    try {
      await api.post("/documentos", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success("Documentos subidos exitosamente");
      loadDocumentos();
    } catch {
      toast.error("Error al subir documentos");
    } finally {
      setUploading(false);
    }
  };

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    multiple: true,
    disabled: uploading || loading,
  });

  useEffect(() => {
    loadData();
    if (examenId) {
      loadExamen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examenId]);

  return (
    <Stack spacing={3}>
      <Card sx={{ boxShadow: "0 2px 0px rgba(0,0,0,0.1)" }}>
        <CardContent className="!p-6">
          <div className="py-2">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {examenId ? "Editar examen" : "Registrar nuevo examen"}
            </Typography>
            <Typography variant="body" color="text.secondary">
              {examenId
                ? "Modifica los datos del examen en el sistema."
                : "Ingresa los datos del examen para registrarlo en el sistema."}
            </Typography>
          </div>
          <Divider sx={{ mb: 3, mt: 2 }} />

          {loadingData ? (
            <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
              <Typography>Cargando datos...</Typography>
            </Stack>
          ) : (
            <form onSubmit={formik.handleSubmit}>
              <Stack spacing={3}>
                <Autocomplete
                  options={tiposExamen}
                  getOptionLabel={(option) => option.nombre || ""}
                  value={
                    tiposExamen.find(
                      (tipo) => tipo.id === formik.values.tipo_examen_medico_id
                    ) || null
                  }
                  onChange={(event, newValue) => {
                    formik.setFieldValue(
                      "tipo_examen_medico_id",
                      newValue ? newValue.id : ""
                    );
                  }}
                  onBlur={() => {
                    formik.setFieldTouched("tipo_examen_medico_id", true);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tipo de Examen"
                      required
                      error={
                        formik.touched.tipo_examen_medico_id &&
                        Boolean(formik.errors.tipo_examen_medico_id)
                      }
                      helperText={
                        formik.touched.tipo_examen_medico_id &&
                        formik.errors.tipo_examen_medico_id
                      }
                    />
                  )}
                  noOptionsText="No se encontraron tipos de examen"
                  loading={loadingData}
                  loadingText="Cargando tipos de examen..."
                />

                <FormControl required>
                  <InputLabel>Paciente</InputLabel>
                  <Select
                    name="paciente_id"
                    value={formik.values.paciente_id}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    label="Paciente"
                    error={
                      formik.touched.paciente_id &&
                      Boolean(formik.errors.paciente_id)
                    }
                  >
                    {pacientes.map((paciente) => (
                      <MenuItem key={paciente.id} value={paciente.id}>
                        {`${paciente.primer_nombre} ${
                          paciente.apellido_paterno
                        } ${paciente.apellido_materno || ""}`.trim()}{" "}
                        - {paciente.rut}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Diagnóstico"
                  name="diagnosis"
                  value={formik.values.diagnosis}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.diagnosis && Boolean(formik.errors.diagnosis)
                  }
                  helperText={
                    formik.touched.diagnosis && formik.errors.diagnosis
                  }
                  fullWidth
                  multiline
                  rows={3}
                />

                <TextField
                  label="Tratamiento"
                  name="tratamiento"
                  value={formik.values.tratamiento}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.tratamiento &&
                    Boolean(formik.errors.tratamiento)
                  }
                  helperText={
                    formik.touched.tratamiento && formik.errors.tratamiento
                  }
                  fullWidth
                  multiline
                  rows={3}
                />

                <TextField
                  label="Observaciones"
                  name="observaciones"
                  value={formik.values.observaciones}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={
                    formik.touched.observaciones &&
                    Boolean(formik.errors.observaciones)
                  }
                  helperText={
                    formik.touched.observaciones && formik.errors.observaciones
                  }
                  fullWidth
                  multiline
                  rows={3}
                />

                <TextField
                  label="Notas"
                  name="notas"
                  value={formik.values.notas}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.notas && Boolean(formik.errors.notas)}
                  helperText={formik.touched.notas && formik.errors.notas}
                  fullWidth
                  multiline
                  rows={2}
                />

                {/* Sección de Documentos - Disponible en creación y edición */}
                {(role === "medico" || role === "admin") && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Documentos del Examen
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {examenId
                          ? "Sube las cartas múltiples de resultados de exámenes médicos"
                          : "Selecciona los documentos que deseas subir. Se subirán automáticamente al crear el examen."}
                      </Typography>

                      {/* Dropzone para subir documentos */}
                      <Box
                        {...getRootProps()}
                        sx={{
                          border: "2px dashed",
                          borderColor: isDragActive
                            ? "primary.main"
                            : "grey.300",
                          borderRadius: 2,
                          p: 4,
                          textAlign: "center",
                          cursor: uploading ? "not-allowed" : "pointer",
                          bgcolor: isDragActive
                            ? "action.hover"
                            : "background.paper",
                          transition: "all 0.2s",
                          opacity: uploading ? 0.6 : 1,
                          "&:hover": {
                            borderColor: uploading
                              ? "grey.300"
                              : "primary.main",
                            bgcolor: uploading
                              ? "background.paper"
                              : "action.hover",
                          },
                        }}
                      >
                        <input {...getInputProps()} />
                        <UploadIcon
                          sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
                        />
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          {isDragActive
                            ? "Suelta los archivos aquí"
                            : uploading
                            ? "Subiendo documentos..."
                            : "Arrastra archivos aquí"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          o haz clic para seleccionar archivos
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 1, display: "block" }}
                        >
                          Solo se permiten archivos PDF (máximo 10MB por archivo)
                        </Typography>
                      </Box>

                      {/* Lista de archivos pendientes (durante creación) */}
                      {!examenId && pendingFiles.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 600, mb: 2 }}
                          >
                            Archivos listos para subir ({pendingFiles.length})
                          </Typography>
                          <Stack spacing={1}>
                            {pendingFiles.map((file, index) => (
                              <Paper
                                key={index}
                                sx={{
                                  p: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  "&:hover": {
                                    bgcolor: "action.hover",
                                  },
                                }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={2}
                                  alignItems="center"
                                  sx={{ flex: 1 }}
                                >
                                  <DescriptionIcon color="primary" />
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1">
                                      {file.name}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </Typography>
                                  </Box>
                                </Stack>
                                <IconButton
                                  color="error"
                                  onClick={() => removePendingFile(index)}
                                  aria-label={`Eliminar ${file.name}`}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Paper>
                            ))}
                          </Stack>
                        </Box>
                      )}

                      {/* Lista de documentos existentes (durante edición) */}
                      {examenId && documentos.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 600, mb: 2 }}
                          >
                            Documentos subidos ({documentos.length})
                          </Typography>
                          <Stack spacing={1}>
                            {documentos.map((doc) => (
                              <Paper
                                key={doc.id}
                                sx={{
                                  p: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  "&:hover": {
                                    bgcolor: "action.hover",
                                  },
                                }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={2}
                                  alignItems="center"
                                  sx={{ flex: 1 }}
                                >
                                  <DescriptionIcon color="primary" />
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="body1">
                                      {doc.nombre_archivo ||
                                        `Archivo ${doc.id}`}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {new Date(
                                        doc.created_at
                                      ).toLocaleDateString()}
                                    </Typography>
                                  </Box>
                                </Stack>
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    variant="outlined"
                                    startIcon={<VisibilityIcon />}
                                    onClick={() =>
                                      handleDownloadDocument(doc.id)
                                    }
                                  >
                                    Ver Documento
                                  </Button>
                                  <IconButton
                                    color="error"
                                    onClick={() =>
                                      handleDeleteDocument(
                                        doc.id,
                                        doc.nombre_archivo
                                      )
                                    }
                                    aria-label={`Eliminar ${doc.nombre_archivo}`}
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </Stack>
                              </Paper>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </Box>
                  </>
                )}

                <Stack
                  direction="row"
                  spacing={2}
                  justifyContent="flex-end"
                  sx={{ mt: 2 }}
                >
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<LocalHospitalIcon />}
                    disabled={loading || loadingData || uploading}
                  >
                    {loading
                      ? examenId
                        ? "Actualizando..."
                        : "Creando..."
                      : examenId
                      ? "Actualizar Examen"
                      : "Crear Examen"}
                  </Button>
                </Stack>
              </Stack>
            </form>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
