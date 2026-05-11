import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Good Game — Nertz scoring",
        short_name: "Good Game",
        description:
            "Create a room, share a link, and log each round from your own phone. Rounds lock when everyone has saved.",
        start_url: "/",
        display: "standalone",
        background_color: "#17120f",
        theme_color: "#296FB7",
        icons: [
            {
                src: "/favicon.ico",
                sizes: "any",
                type: "image/x-icon",
            },
        ],
    };
}
