export interface KubernetesObject {
  apiVersion: string;
  kind: string;
  metadata: ObjectMeta;
}

export interface ObjectMeta {
  name?: string;
  namespace?: string;
  labels?: { [key: string]: string };
  annotations?: { [key: string]: string };
  creationTimestamp?: string;
  resourceVersion?: string;
  uid?: string;
}

export interface Cluster {
  cpuUsage: number;
  memoryUsage: number;
  cpuTotal: number;
  memoryTotal: number;
  cpuPercentage: number;
  memoryPercentage: number;
  nodes: NodeStats[];
}

export interface NodeStats {
  name: string;
  cpuTotal: number;
  memoryTotal: number;
  memoryUsage: number;
  memoryPercentage: number;
  cpuLoad: number;
  cpuPercentage: number;
  status: NodeStatus;
  conditions?: NodeCondition[];
}

export interface NodeStatus {
  phase?: string;
  conditions?: NodeCondition[];
  addresses?: NodeAddress[];
  capacity?: ResourceList;
  allocatable?: ResourceList;
}

export interface NodeCondition {
  type: string;
  status: string;
  lastHeartbeatTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface NodeAddress {
  type: string;
  address: string;
}

export interface ResourceList {
  [key: string]: string;
}

export interface Pod extends KubernetesObject {
  spec: PodSpec;
  status?: PodStatus;
  metrics?: PodMetrics;
}

export interface PodSpec {
  containers: Container[];
  restartPolicy?: string;
  nodeName?: string;
  serviceAccountName?: string;
}

export interface Container {
  name: string;
  image: string;
  ports?: ContainerPort[];
  env?: EnvVar[];
  resources?: ResourceRequirements;
}

export interface ContainerPort {
  name?: string;
  containerPort: number;
  protocol?: string;
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: EnvVarSource;
}

export interface EnvVarSource {
  fieldRef?: ObjectFieldSelector;
  configMapKeyRef?: ConfigMapKeySelector;
  secretKeyRef?: SecretKeySelector;
}

export interface ObjectFieldSelector {
  fieldPath: string;
}

export interface ConfigMapKeySelector {
  name?: string;
  key: string;
}

export interface SecretKeySelector {
  name?: string;
  key: string;
}

export interface ResourceRequirements {
  limits?: ResourceList;
  requests?: ResourceList;
}

export interface PodStatus {
  phase?: string;
  conditions?: PodCondition[];
  containerStatuses?: ContainerStatus[];
  startTime?: string;
  podIP?: string;
  hostIP?: string;
}

export interface PodCondition {
  type: string;
  status: string;
  lastProbeTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface ContainerStatus {
  name: string;
  state?: ContainerState;
  ready: boolean;
  restartCount: number;
  image: string;
  imageID: string;
}

export interface ContainerState {
  waiting?: ContainerStateWaiting;
  running?: ContainerStateRunning;
  terminated?: ContainerStateTerminated;
}

export interface ContainerStateWaiting {
  reason?: string;
  message?: string;
}

export interface ContainerStateRunning {
  startedAt?: string;
}

export interface ContainerStateTerminated {
  exitCode: number;
  signal?: number;
  reason?: string;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface PodMetrics {
  cpu?: number;        // CPU usage in millicores
  cpuPercent?: number; // CPU usage percentage
  memory?: number;     // Memory usage in bytes
  memoryPercent?: number; // Memory usage percentage
  containers?: ContainerMetrics[];
}

export interface ContainerMetrics {
  name: string;
  cpu?: number;
  memory?: number;
}

export interface Deployment extends KubernetesObject {
  spec: DeploymentSpec;
  status?: DeploymentStatus;
}

export interface DeploymentSpec {
  replicas?: number;
  selector: LabelSelector;
  template: PodTemplateSpec;
  strategy?: DeploymentStrategy;
}

export interface LabelSelector {
  matchLabels?: { [key: string]: string };
  matchExpressions?: LabelSelectorRequirement[];
}

export interface LabelSelectorRequirement {
  key: string;
  operator: string;
  values?: string[];
}

export interface PodTemplateSpec {
  metadata?: ObjectMeta;
  spec?: PodSpec;
}

export interface DeploymentStrategy {
  type?: string;
  rollingUpdate?: RollingUpdateDeployment;
}

export interface RollingUpdateDeployment {
  maxUnavailable?: number | string;
  maxSurge?: number | string;
}

export interface DeploymentStatus {
  observedGeneration?: number;
  replicas?: number;
  updatedReplicas?: number;
  readyReplicas?: number;
  availableReplicas?: number;
  unavailableReplicas?: number;
  conditions?: DeploymentCondition[];
}

export interface DeploymentCondition {
  type: string;
  status: string;
  lastUpdateTime?: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface Service extends KubernetesObject {
  spec: ServiceSpec;
  status?: ServiceStatus;
}

export interface ServiceSpec {
  ports?: ServicePort[];
  selector?: { [key: string]: string };
  clusterIP?: string;
  type?: string;
  externalIPs?: string[];
  sessionAffinity?: string;
  loadBalancerIP?: string;
  loadBalancerSourceRanges?: string[];
  externalName?: string;
}

export interface ServicePort {
  name?: string;
  protocol?: string;
  port: number;
  targetPort?: number | string;
  nodePort?: number;
}

export interface ServiceStatus {
  loadBalancer?: LoadBalancerStatus;
}

export interface LoadBalancerStatus {
  ingress?: LoadBalancerIngress[];
}

export interface LoadBalancerIngress {
  ip?: string;
  hostname?: string;
}

export interface Namespace extends KubernetesObject {
  spec?: NamespaceSpec;
  status?: NamespaceStatus;
}

export interface NamespaceSpec {
  finalizers?: string[];
}

export interface NamespaceStatus {
  phase?: string;
  conditions?: NamespaceCondition[];
}

export interface NamespaceCondition {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface Event extends KubernetesObject {
  involvedObject: ObjectReference;
  reason?: string;
  message?: string;
  source?: EventSource;
  firstTimestamp?: string;
  lastTimestamp?: string;
  count?: number;
  type?: string;
  eventTime?: string;
  series?: EventSeries;
  action?: string;
  related?: ObjectReference;
  reportingController?: string;
  reportingInstance?: string;
}

export interface ObjectReference {
  kind?: string;
  namespace?: string;
  name?: string;
  uid?: string;
  apiVersion?: string;
  resourceVersion?: string;
  fieldPath?: string;
}

export interface EventSource {
  component?: string;
  host?: string;
}

export interface EventSeries {
  count?: number;
  lastObservedTime?: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface ListResponse<T> {
  items: T[];
  metadata?: ListMeta;
}

export interface ListMeta {
  selfLink?: string;
  resourceVersion?: string;
  continue?: string;
  remainingItemCount?: number;
}

// Resource status enums
export enum PodPhase {
  Pending = 'Pending',
  Running = 'Running',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
  Unknown = 'Unknown',
}

export enum ServiceType {
  ClusterIP = 'ClusterIP',
  NodePort = 'NodePort',
  LoadBalancer = 'LoadBalancer',
  ExternalName = 'ExternalName',
}

export enum DeploymentStrategyType {
  Recreate = 'Recreate',
  RollingUpdate = 'RollingUpdate',
}

export enum NamespacePhase {
  Active = 'Active',
  Terminating = 'Terminating',
}
