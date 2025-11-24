import axios from 'axios';
import { saveAs } from 'file-saver';

const apiUrl = import.meta.env.VITE_API_URL;

export const descargarRutogramaExcel = async (rutogramaId: number, cedula: string) => {
  try {
    const response = await axios.get(`${apiUrl}/expediente/rutograma/${rutogramaId}/descargar-excel`, {
      responseType: 'blob', // Importante para manejar archivos
    });

    saveAs(response.data, `Rutagrama-${cedula}.xlsx`);
  } catch (error) {
    console.error('Error al descargar el archivo Excel:', error);
    // Aquí podrías mostrar una notificación de error al usuario
    alert('No se pudo descargar el archivo. Por favor, inténtelo de nuevo.');
  }
};