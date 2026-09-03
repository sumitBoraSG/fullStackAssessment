export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface AppointmentEmailDetails {
  patientName: string;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
}
