import clsx from 'clsx'

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large'
    className?: string
}

export default function LoadingSpinner({ size = 'medium', className }: LoadingSpinnerProps) {
    const sizeClasses = {
        small: 'w-5 h-5',
        medium: 'w-8 h-8',
        large: 'w-12 h-12',
    }

    return (
        <div
            className={clsx(
                'loading-spinner',
                sizeClasses[size],
                className
            )}
        />
    )
}
