import { LifecycleStatus, LifecycleStatusLabels } from '../../lib/types/lifecycle';
import {
    CheckCircle,
    AlertTriangle,
    XCircle,
    Recycle,
    Archive,
    Clock,
    AlertOctagon
} from 'lucide-react';

interface LifecycleStatusBadgeProps {
    status: LifecycleStatus | string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function LifecycleStatusBadge({ status, className = '', size = 'md' }: LifecycleStatusBadgeProps) {
    const normStatus = (status || 'created').toLowerCase() as LifecycleStatus;

    const config = {
        created: {
            color: 'bg-blue-100 text-blue-700 border-blue-200',
            icon: Clock,
            label: LifecycleStatusLabels.created || 'Created'
        },
        active: {
            color: 'bg-green-100 text-green-700 border-green-200',
            icon: CheckCircle,
            label: LifecycleStatusLabels.active || 'Active'
        },
        in_maintenance: {
            color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
            icon: AlertTriangle,
            label: LifecycleStatusLabels.in_maintenance || 'In Maintenance'
        },
        deprecated: {
            color: 'bg-orange-100 text-orange-700 border-orange-300',
            icon: Archive,
            label: LifecycleStatusLabels.deprecated || 'Deprecated'
        },
        recycled: {
            color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            icon: Recycle,
            label: LifecycleStatusLabels.recycled || 'Recycled'
        },
        deactivated: {
            color: 'bg-gray-100 text-gray-600 border-gray-300',
            icon: XCircle,
            label: LifecycleStatusLabels.deactivated || 'Deactivated'
        },
        tampered: {
            color: 'bg-red-600 text-white border-red-700 animate-pulse',
            icon: AlertOctagon,
            label: LifecycleStatusLabels.tampered || 'Tampered'
        },
        replaced: {
            color: 'bg-purple-100 text-purple-700 border-purple-200',
            icon: Recycle,
            label: LifecycleStatusLabels.replaced || 'Replaced'
        }
    };

    const style = config[normStatus] || config.created;
    const Icon = style.icon;

    const sizeClasses = {
        sm: 'px-1.5 py-0.5 text-[10px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm'
    };

    return (
        <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${style.color} ${sizeClasses[size]} ${className}`}>
            <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            {style.label}
        </span>
    );
}
