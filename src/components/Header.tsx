"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <Link href="/home" className={styles.headerLogoLink}>
        <Image
          src="/assets/images/Logo_HealEcho.png"
          alt="Heal Echo 로고"
          width={40}
          height={40}
          className={styles.headerLogoImage}
        />
        <p className={styles.headerLogoText}>Heal Echo</p>
      </Link>
    </header>
  );
}
