'use client';

/**
 * Generates and downloads a printable PDF of a trip itinerary, letting users take an
 * offline, shareable copy of their plan away from the app.
 */
import { useState } from 'react';

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';

interface ScheduleItem {
  title: string;
  time_of_day: string;
  description?: string | null;
}

interface ScheduleDay {
  day_number: number;
  day_date: string;
  items: ScheduleItem[];
}

const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  title: { fontSize: 22, marginBottom: 16 },
  dayHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  item: { fontSize: 11, marginBottom: 4 },
  timeTag: { fontSize: 9, color: '#888' },
});

function TripDocument({
  tripTitle,
  days,
}: {
  tripTitle: string;
  days: ScheduleDay[];
}) {
  return (
    <Document title={tripTitle}>
      <Page size='A4' style={pdfStyles.page}>
        <Text style={pdfStyles.title}>{tripTitle}</Text>
        {days.map((day) => (
          <View key={day.day_number}>
            <Text style={pdfStyles.dayHeading}>
              Day {day.day_number} - {day.day_date}
            </Text>
            {day.items.map((item, i) => (
              <Text key={i} style={pdfStyles.item}>
                <Text style={pdfStyles.timeTag}>{item.time_of_day} </Text>
                {item.title}
                {item.description ? ` - ${item.description}` : ''}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

interface TripPDFButtonProps {
  tripTitle: string;
  days: ScheduleDay[];
}

export function TripPDFButton({ tripTitle, days }: TripPDFButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    setIsGenerating(true);
    try {
      const blob = await pdf(
        <TripDocument tripTitle={tripTitle} days={days} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tripTitle.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <button type='button' onClick={handleDownload} disabled={isGenerating}>
      {isGenerating ? 'Generating...' : 'Download PDF'}
    </button>
  );
}
