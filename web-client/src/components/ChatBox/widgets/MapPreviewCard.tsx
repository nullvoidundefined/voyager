import styles from "./MapPreviewCard.module.scss";

interface MapPreviewCardProps {
    latitude: number;
    longitude: number;
    name: string;
}

export function MapPreviewCard({ latitude, longitude, name }: MapPreviewCardProps) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

    if (!apiKey) {
        return (
            <div className={styles.fallback}>
                <span className={styles.fallbackIcon} aria-hidden="true">
                    {"\uD83D\uDCCD"}
                </span>
                <span>{name}</span>
            </div>
        );
    }

    const lat = latitude;
    const lng = longitude;
    const src =
        `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
        `&zoom=15&size=300x160&scale=2` +
        `&markers=color:0x38bdf8|${lat},${lng}` +
        `&style=feature:all|element:geometry|color:0x131926` +
        `&style=feature:water|color:0x0a0e17` +
        `&style=feature:road|color:0x1e2a3f` +
        `&style=feature:poi|visibility:off` +
        `&style=feature:all|element:labels.text.fill|color:0x7b8599` +
        `&key=${apiKey}`;

    return (
        <div className={styles.card}>
            <img src={src} alt={`Map of ${name}`} className={styles.mapImage} />
        </div>
    );
}
