# 🖥️ ENVIRONNEMENT SYSTÈME - CONFIGURATION CLAUDE CODE

## ℹ️ Informations Système de Base

**Système d'exploitation**: linux x64
**Version**: 6.1.0-37-amd64
**Distribution**: Debian GNU/Linux 12 (bookworm)
**Hostname**: Aoostar-Debian
**Utilisateur actuel**: root

## 🔐 Configuration des Permissions

### Utilisateur Actuel
- **Nom**: root
- **UID**: 0
- **Home**: /root
- **Shell**: /bin/bash
- **Groupes**: root

### Capacités Administratives
- **Est root**: ✅ OUI
- **Peut utiliser sudo**: ✅ OUI
- **Est sudoer**: ❌ NON
- **Peut utiliser su**: ✅ OUI

**⚠️ NOTE IMPORTANTE**: User can access root with 'su' + password (not sudoer)

### 🛡️ RESTRICTIONS IMPORTANTES POUR CLAUDE CODE

#### Accès Administrateur
✅ Utilisateur a accès administrateur

#### Système de Fichiers
**Emplacements en écriture**:
- /etc
- /usr/bin
- /var/log
- /tmp
- /opt
- /usr/local/bin

**Emplacements en lecture seule**:
- Information non disponible

## 🔧 Outils et Capacités Disponibles

### Gestionnaires de Packages
- **apt**: apt 2.6.1 (amd64)
- **snap**: snap    2.70
- **flatpak**: Flatpak 1.14.10

### Outils de Développement
- **node**: v18.19.0 (/usr/bin/node)
- **npm**: 9.2.0 (/usr/bin/npm)
- **python3**: Python 3.11.2 (/usr/bin/python3)
- **pip3**: pip 23.0.1 from /usr/lib/python3/dist-packages/pip (python 3.11) (/usr/bin/pip3)
- **git**: git version 2.39.5 (/usr/bin/git)
- **curl**: curl 7.88.1 (x86_64-pc-linux-gnu) libcurl/7.88.1 OpenSSL/3.0.16 zlib/1.2.13 brotli/1.0.9 zstd/1.5.4 libidn2/2.3.3 libpsl/0.21.2 (+libidn2/2.3.3) libssh2/1.10.0 nghttp2/1.52.0 librtmp/2.3 OpenLDAP/2.5.13 (/usr/bin/curl)
- **wget**: GNU Wget 1.21.3 compilé sur linux-gnu. (/usr/bin/wget)
- **jq**: jq-1.6 (/usr/bin/jq)

### Containerisation
- **docker**: Docker version 28.3.1, build 38b7060
- **podman**: podman version 4.3.1
- **kubectl**: Client Version: v1.33.2
- **helm**: version.BuildInfo{Version:"v3.18.4", GitCommit:"d80839cf37d860c8aa9a0503fe463278f26cd5e2", GitTreeState:"clean", GoVersion:"go1.24.4"}
- **kind**: kind v0.20.0 go1.20.4 linux/amd64

## 🌐 Configuration Réseau

### Interfaces Réseau
- **lo**: 127.0.0.1, ::1
- **eno1**: 192.168.1.8, 2a02:a03f:c7ea:100:6848:5264:aaa6:ccb8, 2a02:a03f:c7ea:100:e532:68c2:7071:2463, 2a02:a03f:c7ea:100:47e1:5648:8c89:dd8f, 2a02:a03f:c7ea:100:5304:266a:9aee:84d1, 2a02:a03f:c7ea:100:a619:d9ca:4e10:2381, 2a02:a03f:c7ea:100:d292:5e40:ea62:cc05, 2a02:a03f:c7ea:100:caff:bfff:fe03:57c2, fe80::caff:bfff:fe03:57c2
- **docker0**: 172.17.0.1, fe80::6868:41ff:fed1:c8f1
- **br-5cc367eb5da6**: 172.18.0.1, fe80::18bf:84ff:fe0c:7676
- **br-2312fc2bd380**: 172.19.0.1, fc00:f853:ccd:e793::1, fe80::44d6:66ff:fe5b:a8d1
- **br-827a0d13cfd5**: 172.20.0.1, fe80::4c83:7ff:feb7:1d52
- **veth65da9fe**: fe80::e847:87ff:fe3b:a371
- **veth18834d4**: fe80::1c53:eeff:feb0:c8bb
- **vethf04db7c**: fe80::782f:44ff:fecf:bcc1
- **vethe4cce2c**: fe80::aca1:4eff:fed2:2ac5
- **vethe8acbee**: fe80::acaa:60ff:fe66:1406
- **vethefd836a**: fe80::c6f:71ff:fedd:c793
- **veth222c27f**: fe80::10cb:27ff:fed3:e4b3
- **veth08d7a96**: fe80::9c84:6eff:fe3e:2b5c
- **veth383c38a**: fe80::7418:36ff:fea1:726f
- **vethf6bc2df**: fe80::746a:68ff:feb6:d288
- **veth27b2391**: fe80::1ca0:2bff:fe5d:9f0e
- **vethb9b63bc**: fe80::78a3:44ff:fee0:611c

### Ports en Écoute
- Information non disponible

### DNS
- 192.168.1.251
- fe80::1ebf:ceff:fe02:8f1e%eno1
- fe80::1ebf:ceff:fe02:9028%eno1
- fdaa:fbbc:bfdd:eef0:ff:f1d0::

## 💾 Configuration Stockage

### Systèmes de Fichiers
- **udev** (/dev): 0/32G utilisé (0%)
- **tmpfs** (/run): 5,0M/6,3G utilisé (1%)
- **/dev/nvme1n1p2** (/): 1,1T/1,8T utilisé (64%)
- **tmpfs** (/dev/shm): 1,6M/32G utilisé (1%)
- **tmpfs** (/run/lock): 16K/5,0M utilisé (1%)
- **/dev/loop0** (/snap/bare/5): 128K/128K utilisé (100%)
- **/dev/loop3** (/snap/gnome-42-2204/202): 517M/517M utilisé (100%)
- **/dev/loop2** (/snap/core22/2010): 74M/74M utilisé (100%)
- **/dev/loop4** (/snap/gtk-common-themes/1535): 92M/92M utilisé (100%)
- **/dev/loop5** (/snap/snap-store/1270): 11M/11M utilisé (100%)
- **/dev/loop7** (/snap/snapd/24718): 51M/51M utilisé (100%)
- **/dev/nvme1n1p1** (/boot/efi): 5,9M/511M utilisé (2%)
- **overlay** (/var/lib/docker/overlay2/a5934528ed42ef3f55fd695680e401fa35ebfde5653a074bd5d4c0283cd1908b/merged): 1,1T/1,8T utilisé (64%)
- **tmpfs** (/run/user/1000): 80M/6,3G utilisé (2%)
- **overlay** (/var/lib/docker/overlay2/83d44cfa8ddef11d91f6d86d479224b780d03dba13bbafdc4af8271302aeb427/merged): 1,1T/1,8T utilisé (64%)
- **overlay** (/var/lib/docker/overlay2/787537df9438d47d8b076797fa651aa6f7d0b116826dda1a90f46efd0effcbd5/merged): 1,1T/1,8T utilisé (64%)
- **overlay** (/var/lib/docker/overlay2/580d93a497eea271bf8022730d7a3d057a75e55a0fdbe61ba8a85fef10e30660/merged): 1,1T/1,8T utilisé (64%)
- **overlay** (/var/lib/docker/overlay2/f26536289ee91bc78f96c89fca5322132c9a0abd493b6317a08a2d75e2362fe2/merged): 1,1T/1,8T utilisé (64%)
- **overlay** (/var/lib/docker/overlay2/f552d9b3bac071ff538dec19a222453a3cb3084c5be47dcd9398fc10568dffa9/merged): 1,1T/1,8T utilisé (64%)
- **overlay** (/var/lib/docker/overlay2/b12c220565c6ae998313194ce95fa7c64e7e70a55511f957b9242c5e4dd5a8c0/merged): 1,1T/1,8T utilisé (64%)
- **overlay** (/var/lib/docker/overlay2/21615891d4f537d9973c9354dadbac2b2f030948c69bf8d17f352739320486da/merged): 1,1T/1,8T utilisé (64%)
- **overlay** (/var/lib/docker/overlay2/1dc5d9be5770991aac89634c690d929178f6f47df690c761d37574ec6e1fdaf7/merged): 1,1T/1,8T utilisé (64%)
- **overlay** (/var/lib/docker/overlay2/49dbece69546b5ce971b4a9d5e3ebc8900b5317dfbd976f390c429a3999b7c36/merged): 1,1T/1,8T utilisé (64%)
- **/dev/loop8** (/snap/core22/2045): 74M/74M utilisé (100%)
- **overlay** (/var/lib/docker/overlay2/d6abd6245436242b11a44b8d273f31e7f85eea69d8c4032ddb00f5f23529206f/merged): 1,1T/1,8T utilisé (64%)
- **/dev/loop1** (/snap/snapd/24792): 50M/50M utilisé (100%)
- **overlay** (/var/lib/docker/overlay2/782c8c42bd0014b4c158abd8ff596a395d3f4322673145da9a88462c4a89a892/merged): 1,1T/1,8T utilisé (64%)

## 🔒 Configuration Sécurité

- **SELinux**: Activé ()
- **AppArmor**: Désactivé
- **Pare-feu**: Désactivé

## 📝 INSTRUCTIONS SPÉCIALES POUR CLAUDE CODE

### Commandes Administratives
1. Utiliser `sudo` pour les tâches administratives
2. Vérifier d'abord si la tâche peut être faite sans sudo

### Installation de Packages
- **Gestionnaire principal**: apt
- **Commande standard**: apt install


### Ports et Services
- **Ports disponibles**: 0 ports en écoute
- **Recommandation**: Utiliser des ports utilisateur (>1024) pour éviter les conflits

---
*Détection effectuée le 2025-07-12T20:17:02.891Z*
*Utilisateur: root@Aoostar-Debian*