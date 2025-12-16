# CatalogoHoy

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

**CatalogoHoy** es una aplicación web moderna para la creación y gestión de catálogos digitales. Desarrollada con Angular y construida sobre la arquitectura de monorepo de Nx, permite a los usuarios crear, personalizar y administrar catálogos de productos de manera eficiente y profesional.

## 🚀 Características Principales

- **Creación de Catálogos**: Interfaz intuitiva para crear catálogos personalizados
- **Gestión de Productos**: Administración completa de productos con imágenes, descripciones y precios
- **Diseño Responsive**: Experiencia optimizada para dispositivos móviles y desktop
- **Arquitectura Modular**: Construido con Nx para escalabilidad y mantenibilidad
- **Componentes Reutilizables**: Librería de componentes UI compartidos

## 📋 Requisitos Previos

- Node.js (versión 18 o superior)
- npm o yarn
- Angular CLI
- Nx CLI

## 🛠️ Instalación

1. Clona el repositorio:

```bash
git clone <repository-url>
cd catalogohoy_frontend_monorepo
```

2. Instala las dependencias:

```bash
npm install
```

3. Instala Nx globalmente (opcional):

```bash
npm install -g nx
```

## 🏃‍♂️ Desarrollo

### Servir la Aplicación

```bash
# Servir la aplicación principal
nx serve catalogohoy

# Servir con configuración específica
nx serve catalogohoy --configuration=development

# Modo watch para desarrollo
nx serve catalogohoy --watch
```

### Generar Librerías

```bash
# Generar una nueva librería de negocio
npx nx g @nx/angular:library libs/catalogohoy/{name} --standalone

# Generar una librería compartida
npx nx g @nx/angular:library libs/@shared/{name} --standalone

# Generar un componente UI
npx nx g @nx/angular:library libs/@ui/{component-name} --standalone
```

## 🧪 Testing

```bash
# Ejecutar tests de toda la aplicación
nx test catalogohoy

# Ejecutar tests de una librería específica
nx test {library-name}

# Ejecutar tests con coverage
nx test {library-name} --coverage

# Ejecutar tests en modo watch
nx test {library-name} --watch

# Ejecutar todos los tests del workspace
nx run-many --target=test --all
```

## 🏗️ Build y Deploy

```bash
# Build de producción
nx build catalogohoy --configuration=production

# Build de todas las librerías
nx run-many --target=build --all

# Verificar proyectos afectados
nx affected:test
nx affected:build
nx affected:lint
```

## 📊 Comandos Útiles de Nx

```bash
# Ver el grafo de dependencias del proyecto
npx nx graph

# Mostrar información de un proyecto específico
npx nx show project catalogohoy

# Listar todos los plugins disponibles
npx nx list

# Ejecutar linting en todo el workspace
nx run-many --target=lint --all

# Verificar formato de código
nx format:check

# Aplicar formato de código
nx format:write
```

## 🛠️ Herramientas de Desarrollo

### Nx Console

Nx Console es una extensión para editores que enriquece la experiencia de desarrollo. Permite ejecutar tareas, generar código y mejora el autocompletado en tu IDE. Está disponible para VSCode e IntelliJ.

[Instalar Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## 📁 Estructura del Proyecto

```
catalogohoy_frontend_monorepo/
├── apps/
│   └── catalogohoy/                 # Aplicación principal
├── libs/
│   ├── @shared/                     # Librerías compartidas
│   ├── @ui/                         # Componentes UI reutilizables
│   └── catalogohoy/                 # Librerías específicas del negocio
├── tools/                           # Herramientas y scripts personalizados
├── nx.json                          # Configuración de Nx
└── package.json                     # Dependencias del workspace
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📚 Enlaces Útiles

Aprende más sobre Nx:

- [Configuración de workspace con Angular](https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Nx en CI/CD](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Gestión de releases con Nx](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [¿Qué son los plugins de Nx?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

Únete a la comunidad de Nx:

- [Discord](https://go.nx.dev/community)
- [Síguenos en X](https://twitter.com/nxdevtools) o [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Canal de Youtube](https://www.youtube.com/@nxdevtools)
- [Blog oficial](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

---

**CatalogoHoy** - Creando catálogos digitales del futuro 🚀
